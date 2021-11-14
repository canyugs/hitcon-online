// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const AsyncLock = require('async-lock');

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
   * @param {MovementManagerServer} movementManager - Handles PlayerSyncMessage.
   * and player locations.
   */
  constructor(dir, gameMap, authServer, broadcaster, io, extMan, movementManager) {
    this.dir = dir;
    this.gameMap = gameMap;
    this.authServer = authServer;
    this.broadcaster = broadcaster;
    this.io = io;
    this.extMan = extMan;
    this.movementManager = movementManager;
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
    this.rpcHandler.registerRPC('teleport', async (serviceName, playerID, mapCoord, facing, allowOverlap) => {
      return await this.teleportPlayer(playerID, MapCoord.fromObject(mapCoord), facing, allowOverlap);
    });
    this.rpcHandler.registerRPC('getToken', async (serviceName, playerID) => {
      return await this.handleGetToken(playerID);
    });
    this.rpcHandler.registerRPC('kickPlayer', async (serviceName, playerID, reason) => {
      return await this.kickPlayer(playerID, reason);
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

  /**
   * Get JWT token according to playerID
   * @param {String} playerID - The ID of the player to call.
   * @return {object} decoded_token - decoded JWT token
   */
  async handleGetToken(playerID) {
    if (playerID in this.socks) {
      return this.socks[playerID].decoded_token;
    }
    return null;
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
   * This is typically called by the main class/function.
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
        const kickIfConnected = (msg.kickIfConnected === true);
        this.addSocket(socket, kickIfConnected);
      });
    });
  }

  /**
   * Kick a player that might not be in this gateway server.
   */
  async kickRemotePlayer(playerID, reason) {
    const playerService = await this.dir.getPlayerGatewayService(playerID);
    if (typeof playerService === 'string') {
      return await this.rpcHandler.callRPC(playerService, 'kickPlayer',
        playerID, reason);
    }
    console.warn('Failed to kick player, no service: ', playerID);
    return false;
  }

  /**
   * Kick the given player with the given reason.
   */
  async kickPlayer(playerID, reason) {
    if (typeof playerID !== 'string' || !(playerID in this.socks)) {
      console.error("Can't kick player: ", playerID);
      return false;
    }
    return await this.notifyKicked(this.socks[playerID], reason);
  }

  /**
   * Notify a player that the player have been kicked.
   */
  async notifyKicked(socket, reason) {
    socket.emit('kicked', reason);
    await new Promise((r) => setTimeout(r, 5000));
    socket.disconnect();
  };

  /**
   * Accept an authorized user's socket.
   * This is usually called by addUnauthSocket() above.
   * socket.decoded_token.uid should be populated and is the User ID.
   * @param {Socket} socket - The socket.io socket of the authorized user.
   */
  async addSocket(socket, kickIfConnected) {
    // This socket is authenticated, we are good to handle more events from it.

    const playerID = socket.decoded_token.sub;

    // Let everyone know we've accepted this player.
    let ret = await this.rpcHandler.registerPlayer(playerID);
    if (!ret) {
      // Player already connected.
      if (!kickIfConnected) {
        await this.notifyKicked(socket, 'Duplicate connection');
        console.warn(`Player ${playerID} already connected and kickIfConnected=false`);
        return;
      }

      // Try kick player.
      await this.kickRemotePlayer(playerID);
      // Try again in 0.5s.
      await new Promise(resolve => setTimeout(resolve, 500));
      ret = await this.rpcHandler.registerPlayer(playerID);
      if (!ret) {
        await this.notifyKicked(socket, 'Duplicate connection');
        console.warn(`Player ${playerID} already connected but retry still failed`);
        return;
      }
    }

    // Acquire this lock if you need to move the player or during connection/
    // disconnection.
    socket.moveLock = new AsyncLock();

    // Note: We're locking the connection process while there's no code that
    // moves the player because we want ensure that the connection handler
    // (addSocket) does not run concurrent to the disconnection handler
    // (onDisconnect) and connection handler will always run til completion
    // before the disconnection handler have a chance to run.
    await socket.moveLock.acquire('move', async () => {
      // Load the player data.
      socket.playerData = await this.dir.getPlayerData(playerID);
      socket.playerID = playerID;

      // Notify the client about any previous data.
      socket.emit('previousData', PlayerSyncMessage.fromObject(socket.playerData));

      socket.on('disconnect', (reason) => {
        this.onDisconnect(socket, reason);
        // onDisconnect is async, so returns immediately.
      });

      // Add it to our records.
      this.socks[playerID] = socket;

      if (socket.disconnected) {
        // Disconnected halfway.
        console.warn(`Player ${playerID} disconnected halfway through.`);
        // Leave onDisconnect() to run in the background.
        // Note: Do *NOT* await here, we might dead lock due to socket.moveLock.
        this.onDisconnect(socket.reason);
        return;
      } else {
        console.log(`Player ${playerID} connected.`);
      }

      socket.on('callC2sAPI', (msg, callback) => {
        const p = this.extMan.onC2sCalled(msg, socket.playerID);
        p.then((msg) => {
          if (typeof msg === 'object' && msg !== null && 'error' in msg && typeof msg.error === 'string') {
            console.error(`c2s call error: ${msg.error}`);
          }
          callback(msg);
        }, (reason) => {
          console.error(`c2s call exception: ${reason}`);
          // Full exception detailed NOT provided for security reason.
          callback({'error': 'exception'});
        });
      });

      // Initialize the player data.
      const initLoc = socket.playerData.mapCoord ?? this.gameMap.getRandomSpawnPoint();
      socket.playerData.mapCoord = initLoc;
      socket.playerData.facing = 'D';
      socket.playerData.lastMovingTime = Date.now();
      socket.playerData.ghostMode = false;

      // notify the client to start the game after his/her avatar is selected
      socket.on('avatarSelect', async (msg) => {
        // initialize the appearance of player
        socket.playerData.displayName = msg.displayName;
        socket.playerData.displayChar = msg.displayChar;

        const firstLocation = PlayerSyncMessage.fromObject(socket.playerData);
        if (!firstLocation.check(this.gameMap.graphicAsset)) {
          // Kick player for invalid avatar args.
          await this.notifyKicked(socket, 'Invalid avatarSelect args');
          return;
        }

        // Occupy the player's current location so the player enters the game.
        await this._enterCoord(firstLocation.mapCoord);
        await this._broadcastPlayerUpdate(firstLocation);

        // Note that it is required that we do not have any away between
        // sendStateTransfer() to 'gameStart' emission
        this.broadcaster.sendStateTransfer(socket);

        // Emit the gameStart event.
        const startPack = {playerID: socket.playerData.playerID};
        socket.emit('gameStart', startPack);

        // Player is now free to move around after the first location have been
        // broadcasted and the game start event have been emitted.
        socket.on('playerUpdate', (msg) => {
          this.onPlayerUpdate(socket, PlayerSyncMessage.fromObject(msg));
          // onPlayerUpdate is async, so returns immediately.
        });
      });
    });
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

    await socket.moveLock.acquire('move', async () => {
      if (this.socks[playerID] !== socket) {
        // This should not happen.
        console.error(`Player ${playerID}'s socket mismatch when disconnected.`);
      } else {
        // Take socket off first to avoid race condition in the await below.
        delete this.socks[playerID];
      }

      const lastLocation = PlayerSyncMessage.fromObject({playerID, removed: true});
      await this._broadcastPlayerUpdate(lastLocation);

      // release grid after disconnection
      await this._leaveCoord(socket.playerData.mapCoord);

      // Try to unregister the player.
      await this.rpcHandler.unregisterPlayer(playerID);
      console.log(`Player ${playerID} disconnected`);
    });
  }

  /**
   * Callback for the playerUpdate message from the client.
   * Performs some check on the update message.
   * @param {Socket} socket - The socket from which this is sent.
   * @param {PlayerSyncMessage} updateMsg - The update message.
   */
  async onPlayerUpdate(socket, updateMsg) {
    updateMsg.updateSuccess = true;
    const failOnPlayerUpdate = ((socket, updateMsg) => {
      const msg = PlayerSyncMessage.fromObject(socket.playerData);
      msg.updateSuccess = false;
      msg.clientTime = updateMsg.clientTime;
      socket.emit('playerUpdate', msg);
    }).bind(this, socket, updateMsg);

    if (socket.playerID !== updateMsg.playerID) {
      console.error(`Player '${updateMsg.playerID}' tries to update player '${socket.playerID}'s data, which is invalid.`);
      return;
    }

    if (!updateMsg.check(this.gameMap.graphicAsset)) {
      failOnPlayerUpdate();
      return;
    }

    // if the player moves
    if (updateMsg.mapCoord !== undefined) {
      this.movementManager.handlePlayerMove(this, socket, updateMsg, failOnPlayerUpdate.bind(this));
      return;
    } else {
      // If the player didn't move, still update everyone.
      // Could be name change or something else.
      await this._broadcastPlayerUpdate(updateMsg);
    }
  }

  /**
   * Teleport the player to the specified map coordinate (without any checking).
   * This is an internal function that requires the socket.
   * If `ghostMode` is specified in msg, this function will not fail.
   * @param {Socket} socket - TODO
   * @param {PlayerSyncMessage} msg - TODO
   * @param {Boolean} allowOverlap - If true, disable occupation check.
   * @return {Boolean} - success or not
   */
  async _teleportPlayerInternal(socket, msg, allowOverlap=false) {
    const res = await socket.moveLock.acquire('move', async () => {
      const ret = await this._enterCoord(msg.mapCoord);

      // If the player was in ghost mode, ignore the occupation check.
      if (!(socket.playerData.ghostMode || allowOverlap)) {
        // If the player moves in normal mode, check the occupation.
        if (!msg.ghostMode && !ret) {
          await this._leaveCoord(msg.mapCoord);
          return false;
        }
      }

      // Leave the previous location.
      await this._leaveCoord(socket.playerData.mapCoord);

      // Everything seems well, update everyone on our new location.
      await this._broadcastPlayerUpdate(msg);
      return true;
    });
    return res;
  }

  /**
   * Teleport the player to the specified map coordinate (without any checking).
   * This function can be called by extension or trusted external code.
   */
  async teleportPlayer(playerID, mapCoord, facing, allowOverlap) {
    if (!(playerID in this.socks)) {
      console.error(`Can't teleport ${playerID} who is not on our server.`);
      return false;
    }
    if (allowOverlap !== true) {
      allowOverlap = false;
    }
    const socket = this.socks[playerID];
    const msg = PlayerSyncMessage.fromObject(this.socks[playerID].playerData);
    msg.facing = facing;
    msg.mapCoord = mapCoord;
    return this._teleportPlayerInternal(socket, msg, allowOverlap);
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

  /**
   * Move a player into the target map coordinate.
   * Return true if the map coordinate was not occupied by any player.
   * @param {MapCoord} mapCoord
   * @return {Boolean}
   */
  async _enterCoord(mapCoord) {
    const ret = await this.dir.getRedis().incrAsync([mapCoord.toRedisKey()]);
    return ret === 1;
  }

  /**
   * Clear a player's occupation record of the mapCoord.
   * @param {MapCoord} mapCoord
   */
  async _leaveCoord(mapCoord) {
    await this.dir.getRedis().decrAsync([mapCoord.toRedisKey()]);
  }
}

export default GatewayService;
