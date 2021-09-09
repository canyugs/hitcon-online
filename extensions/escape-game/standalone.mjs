// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const randomBytes = require('crypto').randomBytes;
const path = require('path');

import fs from 'fs';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import jwt from 'jsonwebtoken';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';

const MAX_PLAYER_PER_ROOM = 5;
const TERMINAL_SERVER_GRPC_LOCATION = '127.0.0.1:5051';

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
    this.terminals = new Map();
    fs.readdirSync('../run/terminal').forEach((file) => {
      const terminalName = file.slice(0, -('.json'.length));
      const terminal = new TerminalObject(helper, terminalName, `../run/terminal/${file}`);
      this.terminals.set(terminalName, terminal);
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
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }

  /**
   * Create a new room and start all terminal.
   * @param player
   */
  async c2s_createRoom(player) {
    // Check if the player is already in a room.
    if (this.playerToRoom.has(player.playerID)) {
      throw new Error(`Player ${player.playerID} is already in a room.`);
    }

    // Create a new room
    let roomId = randomBytes(32).toString('hex');
    this.rooms.set(roomId, new Room(roomId, this.terminalServerGrpcService));
    await this.rooms.get(roomId).startContainers();
    return roomId;
  }

  /**
   * Join a room.
   * @param {Player} player The player object.
   * @param {string} roomId The room to join, must exist.
   */
  async c2s_joinRoom(player, roomId) {
    // Check if the room exists.
    if (!this.rooms.has(roomId)) {
      throw new Error(`Player ${player.playerID} trys to join an non-exist room ${roomId}.`);
    }

    // Check if the player is already in a room.
    if (this.playerToRoom.has(player.playerID)) {
      throw new Error(`Player ${player.playerID} is already in a room.`);
    }

    // Add to the room.
    this.playerToRoom.set(player.playerID, this.rooms.get(roomId));
    return this.rooms.get(roomId).addPlayer(player.playerID) > 0;
  }

  /**
   * Destroy the room the player belongs to.
   * @param {Player} player The player object.
   */
  async c2s_destroyRoom(player) {
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
   * @param player The player object.
   * @param terminalId The terminal to be accessed.
   * @returns
   */
  async c2s_getAccessToken(player, terminalId) {
    return this.playerToRoom.get(player.playerID).getAccessToken(terminalId);
  }

  /**
   * Get the list of all terminals.
   */
  async c2s_getAllTerminalsList(player) {
    return this.terminals.keys();
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} terminalId - TODO
   * @return {Object}
   */
   async c2s_getTerminalDisplayInfo(player, terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (typeof terminal === 'undefined') return {};
    return terminal.getDisplayInfo();
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} terminalId - TODO
   * @return {mapCoord}
   */
  async c2s_getTerminalInitialPosition(player, terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (typeof terminal === 'undefined') {
      console.error(`Terminal '${terminalId}' not found.`);
      return null;
    }
    return terminal.getInitialPosition();
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} terminalId - TODO
   */
  async c2s_startInteraction(player, terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (typeof terminal === 'undefined') {
      console.error(`Terminal '${terminalId}' not found.`);
      return;
    }
    console.log('c2s_startInteraction', player, terminalId);
    await terminal.startInteraction(player.playerID);
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @return {Array}
   */
  async c2s_getListOfTerminals(player) {
    return Array.from(this.terminals.keys());
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
  constructor(roomId, terminalServerGrpcService) {
    this.roomId = roomId;
    this.terminalServerGrpcService = terminalServerGrpcService;
    this.players = [];
    this.terminals = {}; // Mapping the terminal id to the container id in the terminal server.

    this.defaultTerminals = [{imageName: 'debian:stable', terminalId: 'test'}];
  }

  /**
   * Add a new player.
   * @param {Player} player The player.
   */
  addPlayer(player) {
    if (this.players.length >= MAX_PLAYER_PER_ROOM) {
      return false;
    }
    return this.players.push(player);
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
        this.terminals[defaultTerminal.terminalId] = ret.containerId;
      } catch (e) {
        console.error(e);
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
          containerId: this.terminals[defaultTerminal.terminalId]
        }, {deadline: new Date(Date.now() + 20000)});

        if (!ret.success) {
          console.error(`Fail to kill container ${defaultTerminal.terminalId} ${this.terminals[defaultTerminal.terminalId]}.`);
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
    if (!(terminalId in this.terminals)) {
      throw new Error(`Terminal ${terminalId} doesn't exist.`);
    }
    return jwt.sign({
      containerId: this.terminals[terminalId]
    }, 'secret', {expiresIn: 10});
   }
}

/**
 * Terminal as an Interactive Object.
 */
class TerminalObject extends InteractiveObjectServerBaseClass {
  async sf_showTerminal(playerID, kwargs) {
    await this.helper.callS2cAPI(playerID, 'escape-game', 'showTerminalModal', 60*1000);
    return this.sf_exit(playerID, {});
  }
}

export default Standalone;
