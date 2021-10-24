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

const MAX_PLAYER_PER_ROOM = 5;
const TERMINAL_SERVER_GRPC_LOCATION = '127.0.0.1:5051';

// Bring out the FSM_ERROR for easier reference.
const FSM_ERROR = InteractiveObjectServerBaseClass.FSM_ERROR;
const SF_PREFIX = 's2s_sf_';


/**
 * Terminology:
 * A "terminal" is an interactive object displayed on the map, with an unique ID.
 * A "room" contains some players, with the maximum `MAX_PLAYER_PER_ROOM`.
 * For all rooms, each terminal is assigned a "container" maintained by the terminal server.
 * In a nutshell: (terminal ID, room ID) -> container ID.
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

    // Rooms
    this.rooms = new Map();
    this.playerToRoom = new Map();

    // Terminals
    this.terminalObjects = new Map();
    fs.readdirSync(getRunPath('terminal')).forEach((file) => {
      const terminalName = file.slice(0, -('.json'.length));
      const terminal = new TerminalObject(helper, terminalName, getRunPath('terminal', file));
      this.terminalObjects.set(terminalName, terminal);
    });

    // this.defaultTerminals determines the list of containers to start when the room is created.
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
    });
  }

  /**
   * Create a new room and start all terminal.
   * @param {string} playerID The player ID.
   */
  async createRoom(playerID) {
    // Check if the player is already in a room.
    if (this.playerToRoom.has(playerID)) {
      throw new Error(`Player ${playerID} is already in a room.`);
    }

    // Create a new room
    let roomId = randomBytes(32).toString('hex');
    this.rooms.set(roomId, new Room(roomId, this.terminalServerGrpcService, this.defaultTerminals));
    await this.rooms.get(roomId).startContainers();
    return roomId;
  }

  /**
   * Join a room.
   * @param {string} playerID The player ID.
   * @param {string} roomId The room to join, must exist.
   */
  async joinRoom(playerID, roomId) {
    // Check if the room exists.
    if (!this.rooms.has(roomId)) {
      throw new Error(`Player ${playerID} trys to join an non-exist room ${roomId}.`);
    }

    // Check if the player is already in a room.
    if (this.playerToRoom.has(playerID)) {
      throw new Error(`Player ${playerID} is already in a room.`);
    }

    // Add to the room.
    this.playerToRoom.set(playerID, this.rooms.get(roomId));
    return this.rooms.get(roomId).addPlayer(playerID) > 0;
  }

  /**
   * Destroy the room the player belongs to.
   * @param {Player} player The player object.
   */
  async destroyRoom(player) {
    // Check if the room exists.
    if (!this.playerToRoom.has(player.playerID)) {
      throw new Error(`Player ${player.playerID} trys to destory an non-exist room.`);
    }

    const roomId = this.playerToRoom.get(player.playerID).roomId;

    // Clear the players in the room.
    for (const playerId of Array.from(this.playerToRoom.keys())) {
      if (this.playerToRoom.get(playerId).roomId === roomId) {
        this.playerToRoom.delete(playerId);
      }
    }

    // Destroy the room.
    await this.rooms.get(roomId).destroy();
    delete this.rooms.get(roomId);
  }

  /**
   * Get the access token of a specific terminal.
   * @param playerID The ID of the playerID interacting with the terminal project.
   * @param terminalName The terminal to be accessed.
   * @returns
   */
  async getAccessToken(playerID, terminalName) {
    return this.playerToRoom.get(playerID).getAccessToken(terminalName);
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
   * Show terminal object, called by the interactive object.
   */
  async s2s_sf_showTerminal(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;
    const token = await this.getAccessToken(playerID, sfInfo.name.split(' ')[1]);
    await this.helper.callS2cAPI(playerID, 'escape-game', 'showTerminalModal', 60*1000, token);
    return nextState;
  }


  // Team Manager

  /**
   * Join team using an invitation code by interacting with the NPC.
   */
  async s2s_sf_showDialogAndGetInvitationCode(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, nextStateCantEnter, nextStateNotFound, dialog} = kwargs;
    const res = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithPrompt', 60*1000, sfInfo.name, dialog);

    for (const [roomId, room] of this.rooms) {
      if (room.invitationCode === res.msg) {
        return this.joinRoom(playerID, roomId) ? nextState : nextStateCantEnter;
      }
    }

    //The invitation code is wrong
    return nextStateNotFound;
  }

  /**
   * Create a new room by interacting with the NPC.
   */
  async s2s_sf_createRoom(srcExt, playerID, kwargs, sfInfo) {
    const {nextState} = kwargs;

    const roomId = await this.createRoom(playerID); // create room.
    await this.joinRoom(playerID, roomId); // add the player to the room.
    await this.helper.callS2cAPI(playerID, 'dialog', 'showDialog', 60*1000,
      sfInfo.name, 'Team created, the invitation code is: ' + this.rooms.get(roomId).invitationCode);

    return nextState;
  }
}

/**
 * The class to maintain the state of a room.
 */
class Room {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {string} roomId The identifier of the room.
   * @param {} terminalServerGrpcService The gRPC service.
   */
  constructor(roomId, terminalServerGrpcService, defaultTerminals) {
    this.roomId = roomId;
    this.invitationCode = randomBytes(16).toString('hex');
    this.terminalServerGrpcService = terminalServerGrpcService;
    this.playerIDs = [];
    this.terminals = new Map(); // Mapping the terminal id to the container id in the terminal server.

    this.defaultTerminals = defaultTerminals;
  }

  /**
   * Add a new player.
   * @param {string} playerID The player ID.
   */
  addPlayer(playerID) {
    if (this.playerIDs.length >= MAX_PLAYER_PER_ROOM) {
      return false;
    }
    return this.playerIDs.push(playerID);
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
   * Destroy the room.
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
