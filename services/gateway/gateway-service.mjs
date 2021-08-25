// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');
const movingRequestThreshold = config.get('movingRequestThreshold');

import {MapCoord} from '../../common/maplib/map.mjs';
import {PlayerSyncMessage} from '../../common/gamelib/player.mjs';

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
    this.broadcaster.registerOnPlayerUpdate((msg) => {
      // Broadcast the player update message.
      this.io.emit('playerUpdate', msg);
    });
    this.broadcaster.registerOnExtensionBroadcast((bc) => {
      // Broadcast the extension broadcast.
      this.io.emit('extBC', bc);
    });
    this.broadcaster.registerOnCellSetBroadcast((msg) => {
      // Broadcast the cell set modification.
      this.io.emit('cellSet', msg);
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
    socket.on('playerUpdate', (msg) => {
      this.onPlayerUpdate(socket, PlayerSyncMessage.fromObject(msg));
      // onPlayerUpdate is async, so returns immediately.
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
    let initLoc = socket.playerData.mapCoord ?? this.gameMap.getRandomSpawnPointNoStarvation();
    while (true) {
      if (await this._occupyCoord(initLoc, playerID)) break;
      initLoc = this.gameMap.getRandomSpawnPointNoStarvation();
    }
    socket.playerData.mapCoord = initLoc;
    socket.playerData.lastMovingTime = Date.now();
    const firstLocation = {
      playerID,
      displayName: socket.playerData.displayName,
      displayChar: socket.playerData.displayChar,
      mapCoord: socket.playerData.mapCoord,
      facing: socket.playerData.facing,
      lastMovingTime: socket.playerData.lastMovingTime,
    };

    const firstLocation = PlayerSyncMessage.fromObject(socket.playerData);
    await this._broadcastPlayerUpdate(firstLocation);
    this.broadcaster.sendStateTransfer(socket);

    // Emit the gameStart event.
    const startPack = {playerData: socket.playerData};
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

    const lastLocation = PlayerSyncMessage.fromObject({playerID, removed: true});
    await this._broadcastPlayerUpdate(lastLocation);

    // release grid after disconnection
    await this._clearOccupy(socket.playerData.mapCoord, playerID);

    // Try to unregister the player.
    await this.rpcHandler.unregisterPlayer(playerID);
    console.log(`Player ${playerID} disconnected`);
  }

  /**
   * Callback for the playerUpdate message from the client.
   * @param {Socket} socket - The socket from which this is sent.
   * @param {PlayerSyncMessage} origMsg - The update message.
   */
  async onPlayerUpdate(socket, origMsg) {
    if (socket.playerID !== origMsg.playerID) {
      console.error(`Player '${origMsg.playerID}' tries to update player '${socket.playerID}'s data, which is invalid.`);
      return;
    }

    const msg = PlayerSyncMessage.fromObject(socket.playerData);
    msg.facing = origMsg.facing;
    msg.mapCoord = MapCoord.fromObject(origMsg.mapCoord);
    // TODO: Check if facing is valid.
    // TODO: Check if movement is legal.

    const lastCoord = socket.playerData.mapCoord;
    const mapSize = this.gameMap.getMapSize(lastCoord.mapName);
    if (lastCoord.x === undefined || lastCoord.y === undefined || lastCoord.mapName === undefined) {
      // Shouldn't happen, log an error.
      console.error(`Invalid lastCoord in onPlayerUpdate ${lastCoord}`);
      return;
    }
    if (!this._movementRequestSpeedCheck(socket.playerData)) {
      console.warn(`Player ${msg.playerID} is overspeed.`);
      return;
    }
    // TODO(whyang9701): Move this into the library as well.
    if (!(lastCoord.mapName === msg.mapCoord.mapName)) {
      console.warn(`Player ${msg.playerID} changed map from ` +
        `${lastCoord.mapName} to ${msg.mapCoord.mapName} without permission.`);
      return;
    }
    // target position is in the map
    if (!this._borderCheck(msg.mapCoord, mapSize)) {
      console.warn(`Player ${msg.playerID} is trying to go outside the map.`);
      return;
    }
    // nearby grid check
    if (!this._nearbyGridCheck(msg.mapCoord, lastCoord)) {
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
    if (!ret) {
      // Can't move, target is already occupied.
      return false;
    }

    //release old grid
    socket.playerData.lastMovingTime = Date.now();
    await this._clearOccupy(socket.playerData.mapCoord, msg.playerID);
    await this._broadcastPlayerUpdate(msg);
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
    const msg = PlayerSyncMessage.fromObject(this.socks[playerID].playerData);
    msg.facing = facing;
    msg.mapCoord = mapCoord;
    return this._teleportPlayerInternal(socket, msg);
  }

  /**
   * Broadcast the user's status.
   * @private
   * @param {PlayerSyncMessage} msg - The message.
   * @return {Boolean} success - true if successful.
   */
  async _broadcastPlayerUpdate(msg) {
    if (msg.playerID in this.socks && !msg.removed) {
      this.socks[msg.playerID].playerData.updateFromMessage(msg);
      await this.dir.setPlayerData(msg.playerID, this.socks[msg.playerID].playerData);
    }
    await this.broadcaster.notifyPlayerUpdate(msg);
    return true;
  }

  // TODO(whyang9701): Move this into map.mjs.
  _getManhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  _borderCheck(coord, mapSize) {
    if (coord.x >= mapSize.width || coord.x < 0) {
      return false;
    }
    if (coord.y >= mapSize.height || coord.y < 0) {
      return false;
    }
    return true;
  }

  _nearbyGridCheck(coord, lastCoord) {
    let distanceSquire = this._getManhattanDistance(lastCoord, coord);
    if (distanceSquire > 1) {
      return false;
    }
    return true;
  }

  _movementRequestSpeedCheck(playerData) {
    if (playerData.lastMovingTime === undefined) {
      console.log('player has no last time record');
      return false;
    }
    if (Date.now() - playerData.lastMovingTime < movingRequestThreshold ) {
      return false;
    }
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
