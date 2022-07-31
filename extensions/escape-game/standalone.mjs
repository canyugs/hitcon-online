// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const randomBytes = require('crypto').randomBytes;
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('config');
const QRCode = require('qrcode');

import fs from 'fs';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';
const LAYER_DOOR = {zIndex: 6, layerName: 'escapeGameDoor'};
import CellSet from '../../common/maplib/cellset.mjs';
const MAX_PLAYER_PER_TEAM = 5;

// Bring out the FSM_ERROR for easier reference.
const FSM_ERROR = InteractiveObjectServerBaseClass.FSM_ERROR;
const SF_PREFIX = 's2s_sf_';


/**
 * Get config from config with default.
 */
function getConfigWithDefault(entry, def) {
  let res = def;
  try {
    res = config.get(entry);
  } catch (e) {
    console.warn('Failed to get config with default: ', entry, e);
  }
  return res;
}


const TERMINAL_SERVER_GRPC_LOCATION = getConfigWithDefault('terminal.internalAddress', '127.0.0.1') + ':' + getConfigWithDefault('terminal.grpcPort', 5051).toString();

/**
 * Terminology:
 * A "terminal" is an interactive object displayed on the map, with an unique ID.
 * A "team" contains some players, with the maximum `MAX_PLAYER_PER_TEAM`.
 * For all teams, each terminal is assigned a "container" maintained by the terminal server.
 * In a nutshell: (terminal ID, team ID) -> container ID.
 */

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;

    // Teams
    this.teams = new Map();
    this.playerToTeam = new Map();

    // Terminals
    this.terminalObjects = new Map();
    fs.readdirSync(getRunPath('terminal')).filter(v => v.endsWith('.json')).forEach((file) => {
      const terminalName = file.slice(0, -('.json'.length));
      const terminal = new TerminalObject(helper, terminalName, getRunPath('terminal', file));
      this.terminalObjects.set(terminal.visibleName, terminal);
    });

    // this.defaultTerminals determines the list of containers to start when the team is created.
    this.defaultTerminals = [];
    this.terminalObjects.forEach((terminalObject, terminalId) => {
      this.defaultTerminals.push({
        terminalId: terminalId,
        imageName: terminalObject.config.terminalInfo.imageName
      });
    });

    // gRPC server
    const packageDefinition = protoLoader.loadSync(
      path.dirname(fileURLToPath(import.meta.url)) + '/../../terminal-server/terminal.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    const rpcProto = grpc.loadPackageDefinition(packageDefinition).TerminalServer;
    this.terminalServerGrpcService = new rpcProto.TerminalServer(TERMINAL_SERVER_GRPC_LOCATION, grpc.credentials.createInsecure());

    // Redeem code
    this.distributedCodes = {};

    this.doorOpenPressedCount = 0;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    await this._loadFromDisk();

    await this.helper.callS2sAPI('iobj-lib', 'reqRegister');
    this.terminalObjects.forEach((v) => {
      v.registerExtStateFunc('showTerminal', 'escape-game', 'sf_showTerminal');
      v.registerExtStateFunc('checkIsInFinalizedTeam', 'escape-game', 'sf_checkIsInFinalizedTeam');
    });
    this.doorCells = [config.get('escape-game.doorPosition')];
    const mapName = "world1";
    await this.helper.broadcastCellSetUpdateToAllUser(
      'set',
      mapName,
      CellSet.fromObject({
        name: LAYER_DOOR.layerName,
        priority: 3,
        cells: [],
        layers: {[LAYER_DOOR.layerName]: "B", "wall": true},
        dynamic: true,
      }),
    );
    await this.helper.broadcastCellSetUpdateToAllUser(
      'update',
      "world1",
      CellSet.fromObject({
        name: LAYER_DOOR.layerName,
        cells: this.doorCells
      }),
    );
  }

  /**
   * Return the public address of the terminal server.
   */
  async c2s_getTerminalServerAddress(player) {
    return {
      address: getConfigWithDefault('terminal.publicAddress', '127.0.0.1'),
      path: getConfigWithDefault('terminal.socketioPath', '') + '/socket.io'
    };
  }

  async e2s_openDoor(duration) {
    if (typeof duration !== "number") {
      return false;
    }

    ++this.doorOpenPressedCount;
    await this.helper.broadcastCellSetUpdateToAllUser(
      'update',
      "world1",
      CellSet.fromObject({
        name: LAYER_DOOR.layerName,
        cells: []
      }),
    );
    setTimeout(async function(obj) {
      if (--obj.doorOpenPressedCount == 0) {        
        await obj.helper.broadcastCellSetUpdateToAllUser(
          'update',
          "world1",
          CellSet.fromObject({
            name: LAYER_DOOR.layerName,
            cells: obj.doorCells
          }),
        );  
      }
    }, duration, this);
    return true;
  }

  /**
   * Create a new team and start all terminal.
   * @param {string} playerID The player ID.
   */
  async createTeam(playerID) {
    // check _unpackStoredData(), it should mirror this function.

    // Check if the player is already in a team.
    if (this.playerToTeam.has(playerID)) {
      throw new Error(`Player ${playerID} is already in a team.`);
    }

    // Create a new team
    let teamId = randomBytes(32).toString('hex');
    this.teams.set(teamId, new Team(teamId, this.terminalServerGrpcService, this.defaultTerminals));
    this.teams.get(teamId).startContainers(); // do not wait for the container to start.
    await this.saveData();
    return teamId;
  }

  /**
   * Join a team.
   * @param {string} playerID The player ID.
   * @param {string} teamId The team to join, must exist.
   */
  async joinTeam(playerID, teamId) {
    // Check if the team exists.
    if (!this.teams.has(teamId)) {
      throw new Error(`Player ${playerID} trys to join an non-exist team ${teamId}.`);
    }

    // Check if the player is already in a team.
    if (this.playerToTeam.has(playerID)) {
      throw new Error(`Player ${playerID} is already in a team.`);
    }

    // Add to the team.
    const ret = this.teams.get(teamId).addPlayer(playerID) > 0;

    if (ret) {
      this.playerToTeam.set(playerID, this.teams.get(teamId));
      await this.saveData();

      // Notify other team members.
      const displayName = this.helper.gameState.getPlayer(playerID).displayName;
      for (const pid of this.teams.get(teamId).playerIDs) {
        if (pid !== playerID) {
          this.helper.callS2cAPI(pid, 'notification', 'showNotification', 5000, `${displayName} has join the team.`);
        }
      }
    } else {
      // Just to be safe.
      await this.saveData();
    }

    return ret;
  }

  /**
   * Quit the team
   * @param {string} playerID The player id.
   */
  async quitTeam(playerID) {
    // Check if the team exists.
    if (!this.playerToTeam.has(playerID)) {
      throw new Error(`Player ${playerID} trys to quit a non-exist team.`);
    }

    const team = this.playerToTeam.get(playerID);

    let ret = true;

    // Remove all items get after joining the team.
    // TODO: This should be done in the Team object instead of here for better abstraction.
    for (const [itemName, amount] of team.givenItems.get(playerID)) {
      const curAmount = (await this.helper.callS2sAPI('items', 'CountItem', playerID, itemName))?.amount;
      ret = ret && (await this.helper.callS2sAPI('items', 'TakeItem', playerID, itemName, Math.min(curAmount, amount)));
    }

    // Remove the player from the team.
    ret = ret && team.removePlayer(playerID);
    await this.saveData();

    if (ret) {
      this.playerToTeam.delete(playerID);

      // Notify other team members.
      const displayName = this.helper.gameState.getPlayer(playerID).displayName;
      for (const pid of team.playerIDs) {
        this.helper.callS2cAPI(pid, 'notification', 'showNotification', 5000, `${displayName} has left the team.`);
      }
    }

    // remove team if all players quit
    if (team.playerIDs.length == 0) {
      await this.destroyTeam(team.teamId);
    }

    return ret;
  }

  /**
   * Destroy the team.
   * @param {string} teamId The team id.
   */
  async destroyTeam(teamId) {
    // Check if the team exists.
    if (!this.teams.has(teamId)) {
      throw new Error(`The team ID ${teamId} doesn't exist.`);
    }

    // Clear the players in the team.
    for (const playerId of Array.from(this.playerToTeam.keys())) {
      if (this.playerToTeam.get(playerId).teamId === teamId) {
        this.playerToTeam.delete(playerId);
      }
    }

    // Destroy the team.
    await this.teams.get(teamId).destroy();
    this.teams.delete(teamId);
    await this.saveData();
  }

  /**
   * Finalize a team
   * @param {string} playerID The player id.
   * @param {string} teamId The team id.
   */
   async finalizeTeam(playerID, teamId) {
    // Check if the team exists.
    if (!this.teams.has(teamId)) {
      throw new Error(`The team ID ${teamId} doesn't exist.`);
    }

    this.teams.get(teamId).isFinalized = true;
    await this.saveData();

    // Notify other team members.
    const displayName = this.helper.gameState.getPlayer(playerID).displayName;
    for (const pid of this.playerToTeam.get(playerID).playerIDs) {
      if (pid !== playerID) {
        this.helper.callS2cAPI(pid, 'notification', 'showNotification', 5000, `Your team has been finalized by ${displayName}`);
      }
    }

  }

  /**
   * Get the access token of a specific terminal.
   * @param playerID The ID of the playerID interacting with the terminal project.
   * @param terminalName The terminal to be accessed.
   * @returns
   */
  async getAccessToken(playerID, terminalName) {
    return this.playerToTeam.get(playerID).getAccessToken(terminalName);
  }

  /**
   * Query the team status of a player.
   * @param {string} extName The caller.
   * @param {string} playerID The player ID.
   */
  async s2s_queryPlayerStatus(extName, playerID) {
    console.log(playerID, this.playerToTeam);
    const playerStatus = {};
    if (!this.playerToTeam.has(playerID)) {
      playerStatus.hasTeam = false;
      return playerStatus;
    }

    playerStatus.hasTeam = true;
    playerStatus.teamId = this.playerToTeam.get(playerID).teamId;
    playerStatus.invitationCode = this.playerToTeam.get(playerID).invitationCode;
    playerStatus.playerIDs = this.playerToTeam.get(playerID).playerIDs;
    playerStatus.isFinalized = this.playerToTeam.get(playerID).isFinalized;

    return playerStatus;
  }


  // Interactive Object (general)

  /**
   * Register the state func with the extension given.
   */
  async _registerWith(ext) {
    const propList = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
    for (const p of propList) {
      if (typeof this[p] !== 'function') continue;
      if (!p.startsWith(SF_PREFIX)) continue;
      const fnName = p.substr(SF_PREFIX.length);
      this.helper.callS2sAPI(ext, 'registerStateFunc', fnName, this.helper.name, `sf_${fnName}`);
    }
  }

  /**
   * Register all state func available in this extension with the given
   * extension.
   */
  async s2s_reqRegister(srcExt, ext) {
    if (!ext) ext = srcExt;
    await this._registerWith(ext);
  }

  /**
   * Allow other ext to add state func.
   */
  async s2s_registerStateFunc(srcExt, fnName, extName, methodName) {
    this.terminalObjects.forEach((v) => {
      v.registerExtStateFunc(fnName, extName, methodName);
    });
  }


  // Terminal Interactive Object

  /**
   * Get the list of all terminals. (for the interactive object)
   */
  async c2s_getAllTerminalsList(player) {
    return this.terminalObjects.keys();
  }

  /**
   * Get the client side info for the terminal. (for the interactive object)
   * @param {Object} player The player object
   * @param {String} terminalId The terminal to be accessed.
   * @return {Object} clientInfo
   */
  async c2s_getTerminalClientInfo(player, terminalId) {
    const terminal = this.terminalObjects.get(terminalId);
    if (typeof terminal === 'undefined') {
      console.error(`Terminal '${terminalId}' not found.`);
      return null;
    }
    return terminal.getClientInfo();
  }

  /**
   * This is called when the user interact with the Terminal interactive object.
   * @param {Object} player The player object
   * @param {String} terminalId The terminal to be accessed.
   */
  async c2s_startInteraction(player, terminalId) {
    const terminal = this.terminalObjects.get(terminalId);
    if (typeof terminal === 'undefined') {
      console.error(`Terminal '${terminalId}' not found.`);
      return;
    }
    await terminal.startInteraction(player.playerID);
  }

  /**
   * Get the list of terminals. (for the interactive object)
   * @param {Object} player The player object
   * @return {Array}
   */
  async c2s_getListOfTerminals(player) {
    return Array.from(this.terminalObjects.keys());
  }

  /**
   * Check if the player is in a finalized team and therefore can access the game.
   */
  async s2s_sf_checkIsInFinalizedTeam(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, errorState} = kwargs;

    if (this.playerToTeam.has(playerID) && this.playerToTeam.get(playerID).isFinalized) {
      return nextState;
    }

    return errorState;
  }

  /**
   * Show terminal object, called by the interactive object.
   */
  async s2s_sf_showTerminal(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;
    const token = await this.getAccessToken(playerID, sfInfo.visibleName);
    await this.helper.callS2cAPI(playerID, 'escape-game', 'showTerminalModal', 60*1000, token);
    return nextState;
  }


  // Team Manager

  async s2s_sf_checkIsInTeam(srcExt, playerID, kwargs, sfInfo) {
    const {indivMenu, teamMenu} = kwargs;
    return this.playerToTeam.has(playerID) ? teamMenu : indivMenu;
  }

  /**
   * Join team using an invitation code by interacting with the NPC.
   */
  async s2s_sf_joinTeamByInvitationCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, nextStateCantEnter, nextStateNotFound, dialog} = kwargs;
    try {
      const res = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithPrompt', 60*1000, sfInfo.name, dialog);

      for (const [teamId, team] of this.teams) {
        if (team.invitationCode === res.msg) {
          return this.joinTeam(playerID, teamId) ? nextState : nextStateCantEnter;
        }
      }

      //The invitation code is wrong
      return nextStateNotFound;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Create a new team by interacting with the NPC.
   */
  async s2s_sf_createTeam(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    try {
      const teamId = await this.createTeam(playerID); // create team.
      await this.joinTeam(playerID, teamId); // add the player to the team.
      this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
        sfInfo.name, 'Team created, the invitation code is: ' + this.teams.get(teamId).invitationCode);

      return nextState;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Show the team menu. This will be called if the player is already in a team.
   */
  async s2s_sf_showTeamMenu(srcExt, playerID, kwargs, sfInfo) {
    const {showMembers, showInvitationCode, finalize, quitTeam, exit} = kwargs;

    try {
      if (!this.playerToTeam.has(playerID)) {
        throw new Error(`The player ${playerID} isn't in any team.`);
      }

      // The team has finalized.
      if (this.playerToTeam.get(playerID).isFinalized) {
        return (await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000,
          sfInfo.name, 'Team ID: ' + this.playerToTeam.get(playerID).teamId,
          [
            {token: showMembers, display: 'List all members.'},
            {token: showInvitationCode, display: 'Show invitation code.'},
            {token: quitTeam, display: 'Quit Team. You\' lose all progresses and items.'},
            {token: exit, display: 'Bye!'}
          ]
        )).token;
      }

      // The team has not finalized.
      return (await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000,
        sfInfo.name, 'Team ID: ' + this.playerToTeam.get(playerID).teamId,
        [
          {token: showMembers, display: 'List all members.'},
          {token: showInvitationCode, display: 'Show invitation code.'},
          {token: finalize, display: 'Finalize the team and enter the game.'},
          {token: quitTeam, display: 'Quit team.'},
          {token: exit, display: 'Bye!'}
        ]
      )).token;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * List all members in the team.
   */
  async s2s_sf_showMembers(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    try {
      if (!this.playerToTeam.has(playerID)) {
        throw new Error(`The player ${playerID} isn't in any team.`);
      }

      const playerList = `
        <ul>
          ${this.playerToTeam.get(playerID).playerIDs.map(pid => `<li>${this.helper.gameState.getPlayer(pid).displayName}</li>`).join('')}
        </ul>
      `;
      await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
        sfInfo.name, 'Team member:' + playerList);

      return nextState;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Show the invitation code of the team.
   */
  async s2s_sf_showInvitationCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    try {
      if (!this.playerToTeam.has(playerID)) {
        throw new Error(`The player ${playerID} isn't in any team.`);
      }

      await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
        sfInfo.name, 'Invitation code: ' + this.playerToTeam.get(playerID).invitationCode);

      return nextState;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Finalize the team. The team can't start the game if it has not finalized.
   */
  async s2s_sf_finalize(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    try {
      if (!this.playerToTeam.has(playerID)) {
        throw new Error(`The player ${playerID} isn't in any team.`);
      }
      if (this.playerToTeam.get(playerID).isFinalized) {
        throw new Error(`The team ${this.playerToTeam.get(playerID).teamId} has already finalized.`);
      }

      this.finalizeTeam(playerID, this.playerToTeam.get(playerID).teamId);

      // await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000, sfInfo.name, 'Finalized');

      return nextState;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Quit team.
   */
  async s2s_sf_quitTeam(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    try {
      if (!this.playerToTeam.has(playerID)) {
        throw new Error(`The player ${playerID} isn't in any team.`);
      }

      await this.quitTeam(playerID);
      return nextState;
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
    }
  }

  /**
   * Teleport the entire team.
   */
  async s2s_sf_teamTeleport(srcExt, playerID, kwargs, sfInfo) {
    const {mapCoord, nextState} = kwargs;

    if (!this.playerToTeam.has(playerID)) {
      console.error('Failure to teleport team for player, no team: ', playerID);
      return FSM_ERROR;
    }
    const team = this.playerToTeam.get(playerID);

    // Teleport everyone in the team.
    let plist = [];
    for (const pid of team.playerIDs) {
      const p = this.helper.teleport(pid, mapCoord, true);
      // true because we always allow overlap with teleportTeam or it won't work.
      plist.push(p);
    }

    // Wait for the result and check if any failed.
    const rlist = await Promise.all(plist);
    let result = true;
    for (let i = 0; i < rlist.length; i++) {
      if (!rlist[i]) {
        console.warn('Failed to teleport player: ', team.playerIDs[i], team.playerIDs);
        result = false;
      }
    }
    if (result) {
      return nextState;
    }
    return FSM_ERROR;
  }

  /**
   * Give an item to the entire team.
   */
  async s2s_sf_teamGiveItem(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, errorState} = kwargs;
    let {amount, maxAmount, itemName} = kwargs;
    if (!Number.isInteger(amount)) amount = 1;
    if (!Number.isInteger(maxAmount) || maxAmount <= 0) maxAmount = -1;

    // Check if we've a team.
    if (!this.playerToTeam.has(playerID)) {
      console.error('Failure to give item to team for player, no team: ', playerID);
      return errorState;
    }
    const team = this.playerToTeam.get(playerID);
    if (!team.isFinalized) {
      console.error('Failure to give item to team for player, team not finalized: ', playerID, team);
      return errorState;
    }

    // Give items to everyone.
    let plist = [];
    for (const pid of team.playerIDs) {
      const p = this.helper.callS2sAPI('items', 'AddItem', pid, itemName, amount, maxAmount);
      plist.push(p);
    }

    // Wait for the result and check if any failed.
    const rlist = await Promise.all(plist);
    let result = true;
    for (let i = 0; i < rlist.length; i++) {
      if (rlist[i].ok !== true) {
        console.warn('Failed to give items to player: ', rlist[i], team.playerIDs[i], team.playerIDs);
        result = false;
      } else {
        // update the list of given items.
        const orig = team.givenItems.get(team.playerIDs[i]).get(itemName) ?? 0;
        team.givenItems.get(team.playerIDs[i]).set(itemName, orig + rlist[i].amount);
      }
    }
    await this.saveData();
    if (result) {
      return nextState;
    }
    return errorState;
  }


  /**
   * Give a redeem code to the user.
   */
  async s2s_sf_giveRedeemCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, errorState} = kwargs;
    let {redeemCodes, eventName} = kwargs;

    if (!(eventName in this.distributedCodes)) {
      this.distributedCodes[eventName] = {};
    }

    let redeemCode = null;

    const redeemedCodes = new Set(Object.values(this.distributedCodes[eventName]));
    if (!(playerID in this.distributedCodes[eventName])) {
      for (let i = 0; i < redeemCodes.length; i++) {
        if (!redeemedCodes.has(redeemCodes[i])) {
          redeemCode = redeemCodes[i];
          break;
        }
      }
      this.distributedCodes[eventName][playerID] = redeemCode;
      this.saveData();
    } else {
      redeemCode = this.distributedCodes[eventName][playerID];
    }

    if (redeemCode) {
      const url = await (new Promise((res) => {
        const jobj = {code: redeemCode};
        QRCode.toDataURL(JSON.stringify(jobj), function (err, url) {
          if (err) {
            res('');
          } else {
            res(url);
          }
        });
      }));
      // We need to disable XSS because img data url is filtered.
      // TODO: Deal with this properly.
      await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000, 'Redeem Code', `Your redeem code is ${redeemCode}: <br><img src="${url}" />`, 'OK', {disableXSS: true});
      // await this.helper.callS2cAPI(playerID, 'point-system', 'redeemPoints', 60*1000, redeemCode);
      return nextState;
    }
    return errorState;
  }


  /* Data Store */

  async saveData() {
    await this.helper.storeData(this._packStoredData());
  }

  /**
   * Load the database on disk back to this class.
   */
  async _loadFromDisk() {
    const data = await this.helper.loadData();
    if (Object.keys(data).length === 0) {
      // First time loading, we don't need to do anything.
    } else {
      this._unpackStoredData(data);
    }
  }

  /**
   * This function packages all the data that need to be stored into a big object
   * This function is usually called before `this.helper.storeData`
   */
  _packStoredData() {
    const teams = Array.from(this.teams.keys()).map((k) => this.teams.get(k).serialize());
    return {
      teams: teams,
      distributedCodes: this.distributedCodes
    };
  }

  /**
   * This function unpacks a JSON object that is created by _packStoredData() into this.
   */
  _unpackStoredData(data) {
    this.distributedCodes = data?.distributedCodes ?? {};
    if (data.teams) {
      this.teams = new Map();
      this.playerToTeam = new Map();

      data.teams.forEach((tobj) => {
        // Check createTeam(), this should mirror it.
        const t = Team.deserialize(tobj, this.terminalServerGrpcService, this.defaultTerminals);
        this.teams.set(t.teamId, t);
        t.playerIDs.forEach((pid) => {
          this.playerToTeam.set(pid, t);
        });
        t.startContainers();
      });
    }
  }
}

/**
 * The class to maintain the state of a team.
 */
class Team {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {string} teamId The identifier of the team.
   * @param {} terminalServerGrpcService The gRPC service.
   */
  constructor(teamId, terminalServerGrpcService, defaultTerminals) {
    this.teamId = teamId;
    this.invitationCode = randomBytes(8).toString('hex');
    this.terminalServerGrpcService = terminalServerGrpcService;
    this.playerIDs = [];
    this.isFinalized = false;
    this.terminals = new Map(); // Mapping the terminal id to the container id in the terminal server.
    this.givenItems = new Map();

    this.defaultTerminals = defaultTerminals;
  }

  serialize() {
    const result = {};
    result.teamId = this.teamId;
    result.invitationCode = this.invitationCode;
    result.playerIDs = this.playerIDs;
    result.isFinalized = this.isFinalized;
    result.givenItems = {};
    Array.from(this.givenItems.keys()).forEach((k) => {
      const m = this.givenItems.get(k);
      result.givenItems[k] = Object.fromEntries(m);
    });
    return result;
  }

  static deserialize(obj, terminalServerGrpcService, defaultTerminals) {
    const result = new Team(obj.teamId, terminalServerGrpcService, defaultTerminals);
    result.invitationCode = obj.invitationCode;
    result.playerIDs = obj.playerIDs;
    result.isFinalized = obj.isFinalized;
    result.givenItems = new Map(Object.entries(obj.givenItems));
    Array.from(result.givenItems.keys()).forEach((k) => {
      const m = result.givenItems.get(k);
      result.givenItems.set(k, new Map(Object.entries(m)));
    });
    return result;
  }

  /**
   * Add a new player.
   * @param {string} playerID The player ID.
   */
  addPlayer(playerID) {
    if (this.playerIDs.length >= MAX_PLAYER_PER_TEAM || this.isFinalized) {
      return false;
    }
    this.givenItems.set(playerID, new Map());
    return this.playerIDs.push(playerID);
  }

  /**
   * Remove a player.
   * TODO: should deal with the case when the team has finalized.
   * @param {string} playerID The player ID.
   */
  removePlayer(playerID) {
    if (!this.playerIDs.includes(playerID)) {
      return false;
    }
    this.givenItems.delete(playerID);
    this.playerIDs = this.playerIDs.filter(pid => pid !== playerID);
    return true;
  }

  /**
   * Start all containers
   */
  async startContainers() {
    for (const defaultTerminal of this.defaultTerminals) {
      try {
        let ret = await promisify(this.terminalServerGrpcService.CreateContainer.bind(this.terminalServerGrpcService))({
          imageName: defaultTerminal.imageName
        }, {deadline: new Date(Date.now() + 20000)});

        if (!ret.success) {
          console.error(`Fail to start container with image ${defaultTerminal.imageName}.`);
          return false;
        }
        this.terminals.set(defaultTerminal.terminalId, ret.containerId);
      } catch (e) {
        console.error('Failed to start container: ', e);
      }
    }
  }

  /**
   * Destroy the team.
   */
  async destroy() {
    // Remove all containers
    for (const defaultTerminal of this.defaultTerminals) {
      try {
        let ret = await promisify(this.terminalServerGrpcService.DestroyContainer.bind(this.terminalServerGrpcService))({
          containerId: this.terminals.get(defaultTerminal.terminalId)
        }, {deadline: new Date(Date.now() + 20000)});

        if (!ret.success) {
          console.error(`Fail to kill container ${defaultTerminal.terminalId} ${this.terminals.get(defaultTerminal.terminalId)}.`);
          return false;
        }
      } catch (e) {
        console.error(e);
      }
    }

  }

  /**
   * Get JWT for the terminal server.
   * @param {string} terminalId The identifier of the terminal.
   */
  getAccessToken(terminalId) {
    if (!this.isFinalized) {
      throw new Error(`Can't access terminal ${terminalId} if the team is not finalized.`);
    }
    if (!this.terminals.has(terminalId)) {
      throw new Error(`Terminal ${terminalId} doesn't exist.`);
    }
    return jwt.sign({
      containerId: this.terminals.get(terminalId)
    }, 'secret', {expiresIn: 10});
   }
}

/**
 * Terminal as an Interactive Object.
 */
class TerminalObject extends InteractiveObjectServerBaseClass {
}

export default Standalone;
