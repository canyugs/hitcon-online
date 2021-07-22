// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const {Server} = require('socket.io');


import {MapCoord} from '../../common/maplib/map.mjs';
import MoveRule  from '../../common/maplib/move-rule.mjs';
/**
 * This class handles the connections from the client and does the most
 * processing required to service the client.
 */
class GatewayService {
  /**
   * Constructor for GatewayService. This is usually called by the main
   * class/function.
   * At the time when this is called, other services are NOT constructed yet.
   * @constructor
   * @param {Directory} dir - The RPCDirectory for calling other services.
   * @param {GameMap} gameMap - The world map for this game.
   * @param {AuthServer} authServer - Auth server for verifying the token.
   * @param {io} io - Socket.io object.
   * @param {ExtensionManager} extMan - Extension Manager object.
   * and player locations.
   */
  constructor(dir, gameMap, authServer, broadcaster, io, extMan) {
    this.dir = dir;
    this.gameMap = gameMap;
    this.authServer = authServer;
    this.broadcaster = broadcaster;
    this.io = io;
    this.extMan = extMan;
    // A map that tracks the current connected clients.
    // key is the player ID. value is the socket.
    this.socks = {};
    this.moveRule = new MoveRule();
  }

  /**
   * Initialize the gateway service.
   * At the time this is called, other services and extensions have been
   * created, but their initialize() have not been called.
   */
  async initialize(gatewayServiceName) {
    this.rpcHandler = await this.dir.registerService(gatewayServiceName);
    this.extMan.setRpcHandlerFromGateway(this.rpcHandler);
    await this.rpcHandler.registerAsGateway();
    this.rpcHandler.registerRPC('callS2c', this.callS2c.bind(this));
    this.rpcHandler.registerRPC('teleport', async (serviceName, playerID, mapCoord, facing) => {
      return await this.teleportPlayer(playerID, new MapCoord(mapCoord.mapName, mapCoord.x, mapCoord.y), facing);
    });
    this.servers = [];
    await this.extMan.createAllInGateway(this.rpcHandler, this);
    await this.extMan.startAllInGateway();

    // register callbacks for All Area Boardcaster
    this.broadcaster.registerOnLocation((loc) => {
      // Broadcast the location message.
      this.io.emit('location', loc);
    });
    this.broadcaster.registerOnExtensionBroadcast((bc) => {
      // Broadcast the extension broadcast.
      this.io.emit('extBC', bc);
    });
    this.broadcaster.registerOnCellSetBroadcast((cset) => {
      // Broadcast the cell set modification.
      this.io.emit('cset', cset);
    });
  }

  async callS2c(serviceName, playerID, extName, methodName, timeout, args) {
    if (playerID in this.socks) {
      const resultPromise = new Promise((resolve, reject) => {
        const timeoutTimer = setTimeout(() => {
          resolve({error: 'timeout'});
        }, timeout);
        let callArgs = {
          extName: extName,
          methodName: methodName,
          args: args
        };
        this.socks[playerID].emit('callS2cAPI', callArgs, (result) => {
          clearTimeout(timeoutTimer);
          resolve(result);
        });
      });
      return await resultPromise;
    }

    return {error: `Player ${playerID} doesn't exist`};
  }

  /**
   * Add a new socket.io server to this service.
   * This is typtically called by the main class/function.
   * @param {Server} server - The socket.io server to add to this class.
   */
  addServer(server) {
    this.servers.push(server);
    server.on('connection', (socket) => {
      socket.on('authenticate', (msg) => {
        if (!('token' in msg)) {
          socket.emit('unauthorized', {data: 'No token found'});
          return;
        }
        if (typeof msg.token !== 'string') {
          socket.emit('unauthorized', {data: 'Token is not string'});
          return;
        }
        let verified = this.authServer.verifyToken(msg.token);
        if (verified === null) {
          socket.emit('unauthorized', {data: 'Token verification failed'});
          return;
        }
        socket.emit('authenticated', {});
        socket.decoded_token = verified;
        this.addSocket(socket);
      });
    });
  }

  /**
   * Accept an authorized user's socket.
   * This is usually called by addUnauthSocket() above.
   * socket.decoded_token.uid should be populated and is the User ID.
   * @param {Socket} socket - The socket.io socket of the authorized user.
   */
  async addSocket(socket) {
    // This socket is authenticated, we are good to handle more events from it.

    const playerID = socket.decoded_token.sub;

    // Let everyone know we've accepted this player.
    let ret = await this.rpcHandler.registerPlayer(playerID);
    if (!ret) {
      // Player already connected.
      console.warn(`Player ${playerID} already connected`);
      socket.disconnect();
      return;
    }

    // Load the player data.
    socket.playerData = await this.dir.getPlayerData(playerID);
    socket.playerID = playerID;

    // Register all events.
    socket.on('location', (location) => {
      this.onUserLocation(socket, location);
      // onUserLocation is async, so returns immediately.
    });
    socket.on('callC2sAPI', (msg, callback) => {
      const p = this.extMan.onC2sCalled(msg, socket.playerID);
      p.then((msg) => {
        if (typeof msg === 'object' && 'error' in msg && typeof msg.error === 'string') {
          console.error(`c2s call error: ${msg.error}`);
        }
        callback(msg);
      }, (reason) => {
        console.error(`c2s call exception: ${reason}`);
        // Full exception detailed NOT provided for security reason.
        callback({'error': 'exception'});
      });
    });
    socket.on('disconnect', (reason) => {
      this.onDisconnect(socket, reason);
      // onDisconnect is async, so returns immediately.
    });

    // Add it to our records.
    this.socks[playerID] = socket;

    if (socket.disconnected) {
      // Disconnected halfway.
      console.warn(`Player ${playerID} disconnected halfway through.`);
      await this.onDisconnect(socket.reason);
      return;
    } else {
      console.log(`Player ${playerID} connected.`);
    }

    // Synchronize the state.
    let firstLocation = {playerID: playerID, 
      displayName: socket.playerData.displayName};
    firstLocation.mapCoord = socket.playerData.mapCoord;
    firstLocation.facing = 'D';
    firstLocation.displayChar = socket.playerData.displayChar;
    socket.playerData.lastMovingTime = Date.now();
    // try occupying grid
    // TODO: Handle cases when we can't occupy the location.
    await this._occupyCoord(firstLocation.mapCoord, playerID);
    await this._broadcastUserLocation(firstLocation);
    this.broadcaster.sendStateTransfer(socket);

    // Emit the gameStart event.
    let startPack = {};
    startPack.playerData = {};
    for (const k of ['playerID', 'displayName', 'displayChar']) {
      startPack.playerData[k] = socket.playerData[k];
    }
    socket.emit('gameStart', startPack);
  }

  /**
   * Called when the user disconnects.
   * @param {Socket} socket - The socket that disconnected.
   * @param {reason} reason - The reason why we disconnected.
   */
  async onDisconnect(socket, reason) {
    const playerID = socket.decoded_token.sub;
    if (!(playerID in this.socks)) {
      // This could happen in possible race condition between setting up
      // on('disconnect') and when we check connection state again.
      console.error(`Player ${playerID} is non-existent when disconnected.`);
      return;
    }
    if (this.socks[playerID] !== socket) {
      // This should not happen.
      console.error(`Player ${playerID}'s socket mismatch when disconnected.`);
    }

    // Take socket off first to avoid race condition in the await below.
    delete this.socks[playerID];

    let lastLocation = {playerID: playerID, removed: true};
    await this._broadcastUserLocation(lastLocation);

    // release grid after disconnection
    await this._clearOccupy(socket.playerData.mapCoord, playerID);

    // Try to unregister the player.
    await this.rpcHandler.unregisterPlayer(playerID);
    console.log(`Player ${playerID} disconnected`);
  }

  /**
   * Callback for the location message from the client. i.e.
   * socket.on('location')
   * @param {Socket} socket - The socket from which this is sent.
   * @param {Object} msg - The location message. It includes the following:
   * - mapCoord: The map coordinate, whose type is MapCoord.
   * - facing: One of 'U', 'D', 'L', 'R'. The direction the user is facing.
   * It'll also contain other fields that's added elsewhere.
   * - playerID: The player's ID.
   * - displayName: The name to show for this player.
   * - displayChar: The character asset to display.
   */
  async onUserLocation(socket, origMsg) {
    const msg = {};
    msg.playerID = socket.playerID;
    msg.displayName = socket.playerData.displayName;
    msg.displayChar = socket.playerData.displayChar;
    msg.facing = origMsg.facing;
    msg.mapCoord = MapCoord.fromObject(origMsg.mapCoord);
    // TODO: Check if facing is valid.
    // TODO: Check if movement is legal.

    const lastCoord = socket.playerData.mapCoord;
    const mapSize = this.gameMap.getMapSize(lastCoord.mapName);
    if (lastCoord.x === undefined || lastCoord.y === undefined || lastCoord.mapName === undefined) {
      // Shouldn't happen, log an error.
      console.error(`Invalid lastCoord in onUserLocation ${lastCoord}`);
      return;
    }
    if (!this.moveRule.movementRequestSpeedCheck(socket.playerData)) {
      console.warn(`Player ${msg.playerID} is overspeed.`);
      return;
    }
    //target coord is in the same map
    if(!this.moveRule.sameMapCheck(socket.playerData.mapCoord,msg.mapCoord)){
      console.warn(`Player ${msg.playerID} changed map from ` +
        `${lastCoord.mapName} to ${msg.mapCoord.mapName} without permission.`);
      return;
    }
    // target position is in the map
    if (!this.moveRule.borderCheck(msg.mapCoord,mapSize)) {
      console.warn(`Player ${msg.playerID} is trying to go outside the map.`);
      return;
    }
    // nearby grid check
    if (!this.moveRule.nearbyGridCheck(msg.mapCoord,lastCoord)) {
      console.warn(`Player ${msg.playerID} is trynig to teleport.`);
      return;
    }
    // TODO(whyang9701): Add checks for cells that is marked as blocked
    // in the map.
    // TODO: Maybe log any cell collision.
    await this._teleportPlayerInternal(socket, msg);
  }

  /**
   * Teleport the player to the specified map coordinate.
   * This is an internal function that requires the socket.
   */
  async _teleportPlayerInternal(socket, msg) {
    // try occupy grid
    const ret = await this._occupyCoord(msg.mapCoord, msg.playerID);
    // grid has been occupied
    if(!ret){
      // Can't move, target is already occupied.
      return false;
    }

    //release old grid 
    socket.playerData.lastMovingTime = Date.now();
    await this._clearOccupy(socket.playerData.mapCoord, msg.playerID);
    await this._broadcastUserLocation(msg);
    return true;
  }

  /**
   * Teleport the player to the specified map coordinate.
   */
  async teleportPlayer(playerID, mapCoord, facing) {
    if (!(playerID in this.socks)) {
      console.error(`Can't teleport ${playerID} who is not on our server.`);
      return false;
    }
    const socket = this.socks[playerID];
    const msg = {};
    msg.playerID = socket.playerID;
    msg.displayName = socket.playerData.displayName;
    msg.displayChar = socket.playerData.displayChar;
    msg.facing = facing;
    msg.mapCoord = mapCoord;

    return this._teleportPlayerInternal(socket, msg);
  }

  /**
   * Broadcast the user's location and direction.
   * @private
   * @param {Object} msg - The location message.
   * @return {Boolean} success - true if successful.
   */
  async _broadcastUserLocation(msg) {
    if (msg.playerID in this.socks && !(msg.removed === true)) {
      const playerData = this.socks[msg.playerID].playerData;
      playerData.mapCoord = msg.mapCoord;
      await this.dir.setPlayerData(msg.playerID, playerData);
    }
    await this.broadcaster.notifyPlayerLocationChange(msg);
    return true;
  }



  /**
   * Mark the cell specified by mapCoord as occupied by playerID.
   * Note: This is atomic.
   * @return {Boolean} success - Return true if the cell is marked
   * successfully, false if it's occupied.
   */
  async _occupyCoord(mapCoord, playerID) {
    let ret = await this.dir.getRedis().setAsync(
      [mapCoord.toRedisKey(), playerID, 'NX']);
    if (ret === 'OK') {
      return true;
    }
    console.assert(ret === null, `Invalid reply from redis for _occupyCoord: ${ret}`);
    return false;
  }

  /**
   * Clear the cell specified by mapCoord.
   * If playerID is not undefined or null, then verify that it was occupied.
   */
  async _clearOccupy(mapCoord, playerID) {
    if (playerID) {
      // Do the check
      const getRet = await this.dir.getRedis().getAsync(
        [mapCoord.toRedisKey()]);
      if (getRet !== playerID) {
        console.error(
          `Cell ${mapCoord} is not occupied by ${playerID}, it's ${getRet}`);
        return false;
      }
    }
    const ret = await this.dir.getRedis().delAsync([mapCoord.toRedisKey()]);
    if (ret === 1) {
      return true;
    }
    console.error(`Failed to clear cell ${mapCoord}, redis: ${ret}`);
    return false;
  }
}

export default GatewayService;
