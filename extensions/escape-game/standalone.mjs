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

import fs from 'fs';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

const MAX_PLAYER_PER_TEAM = 5;
const TERMINAL_SERVER_GRPC_LOCATION = '127.0.0.1:5051';

// Bring out the FSM_ERROR for easier reference.
const FSM_ERROR = InteractiveObjectServerBaseClass.FSM_ERROR;
const SF_PREFIX = 's2s_sf_';


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
    fs.readdirSync(getRunPath('terminal')).forEach((file) => {
      const terminalName = file.slice(0, -('.json'.length));
      const terminal = new TerminalObject(helper, terminalName, getRunPath('terminal', file));
      this.terminalObjects.set(terminalName, terminal);
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
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    await this.helper.callS2sAPI('iobj-lib', 'reqRegister');
    this.terminalObjects.forEach((v) => {
      v.registerExtStateFunc('showTerminal', 'escape-game', 'sf_showTerminal');
      v.registerExtStateFunc('checkStatus', 'escape-game', 'sf_checkStatus');
    });
  }

  /**
   * Create a new team and start all terminal.
   * @param {string} playerID The player ID.
   */
  async createTeam(playerID) {
    // Check if the player is already in a team.
    if (this.playerToTeam.has(playerID)) {
      throw new Error(`Player ${playerID} is already in a team.`);
    }

    // Create a new team
    let teamId = randomBytes(32).toString('hex');
    this.teams.set(teamId, new Team(teamId, this.terminalServerGrpcService, this.defaultTerminals));
    await this.teams.get(teamId).startContainers();
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
    this.playerToTeam.set(playerID, this.teams.get(teamId));
    return this.teams.get(teamId).addPlayer(playerID) > 0;
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

    const teamId = this.playerToTeam.get(playerID).teamId;

    this.teams.get(teamId).removePlayer(playerID);
    this.playerToTeam.delete(playerID);

    // remove team if all players quit
    if (this.teams.get(teamId).playerIDs.length == 0) {
      await this.destroyTeam(teamId);
    }
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
    delete this.teams.get(teamId);
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
  async s2s_sf_checkStatus(srcExt, playerID, kwargs, sfInfo) {
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
    const token = await this.getAccessToken(playerID, sfInfo.name.split(' ')[1]);
    await this.helper.callS2cAPI(playerID, 'escape-game', 'showTerminalModal', 60*1000, token);
    return nextState;
  }


  // Team Manager

  async s2s_sf_checkTeamStatus(srcExt, playerID, kwargs, sfInfo) {
    const {indivMenu, teamMenu} = kwargs;
    return this.playerToTeam.has(playerID) ? teamMenu : indivMenu;
  }

  /**
   * Join team using an invitation code by interacting with the NPC.
   */
  async s2s_sf_joinTeamByInvitationCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, nextStateCantEnter, nextStateNotFound, dialog} = kwargs;
    const res = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithPrompt', 60*1000, sfInfo.name, dialog);

    for (const [teamId, team] of this.teams) {
      if (team.invitationCode === res.msg) {
        return this.joinTeam(playerID, teamId) ? nextState : nextStateCantEnter;
      }
    }

    //The invitation code is wrong
    return nextStateNotFound;
  }

  /**
   * Create a new team by interacting with the NPC.
   */
  async s2s_sf_createTeam(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    const teamId = await this.createTeam(playerID); // create team.
    await this.joinTeam(playerID, teamId); // add the player to the team.
    await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
      sfInfo.name, 'Team created, the invitation code is: ' + this.teams.get(teamId).invitationCode);

    return nextState;
  }

  /**
   * Show the team menu. This will be called if the player is already in a team.
   */
  async s2s_sf_showTeamMenu(srcExt, playerID, kwargs, sfInfo) {
    const {showMembers, showInvitationCode, finalize, quitTeam, exit} = kwargs;

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
  }

  /**
   * List all members in the team.
   */
  async s2s_sf_showMembers(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    if (!this.playerToTeam.has(playerID)) {
      throw new Error(`The player ${playerID} isn't in any team.`);
    }

    const playerList = `
      <ul>
        ${this.playerToTeam.get(playerID).playerIDs.map(pid => `<li>${pid}</li>`).join('')}
      </ul>
    `;
    await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
      sfInfo.name, 'Team member:' + playerList);

    return nextState;
  }

  /**
   * Show the invitation code of the team.
   */
  async s2s_sf_showInvitationCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    if (!this.playerToTeam.has(playerID)) {
      throw new Error(`The player ${playerID} isn't in any team.`);
    }

    await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
      sfInfo.name, 'Invitation code: ' + this.playerToTeam.get(playerID).invitationCode);

    return nextState;
  }

  /**
   * Finalize the team. The team can't start the game if it has not finalized.
   */
  async s2s_sf_finalize(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    if (!this.playerToTeam.has(playerID)) {
      throw new Error(`The player ${playerID} isn't in any team.`);
    }
    if (this.playerToTeam.get(playerID).isFinalized) {
      throw new Error(`The team ${this.playerToTeam.get(playerID).teamId} has already finalized.`);
    }

    this.playerToTeam.get(playerID).isFinalized = true;
    await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
      sfInfo.name, 'Finalized');

    return nextState;
  }

  /**
   * Quit team.
   */
  async s2s_sf_quitTeam(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    if (!this.playerToTeam.has(playerID)) {
      throw new Error(`The player ${playerID} isn't in any team.`);
    }

    await this.quitTeam(playerID);

    return nextState;
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

    this.defaultTerminals = defaultTerminals;
  }

  /**
   * Add a new player.
   * @param {string} playerID The player ID.
   */
  addPlayer(playerID) {
    if (this.playerIDs.length >= MAX_PLAYER_PER_TEAM || this.isFinalized) {
      return false;
    }
    return this.playerIDs.push(playerID);
  }

  /**
   * Remove a player.
   * TODO: should deal with the case when the team has finalized.
   * @param {string} playerID The player ID.
   */
  removePlayer(playerID) {
    if (!this.playerIDs.includes(playerID) || this.isFinalized) {
      return false;
    }
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
        }, {deadline: new Date(Date.now() + 5000)});

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
