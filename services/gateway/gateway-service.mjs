// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const AsyncLock = require('async-lock');
const bodyParser = require('body-parser');
const config = require('config');

import {MapCoord} from '../../common/maplib/map.mjs';
import {PlayerSyncMessage} from '../../common/gamelib/player.mjs';

const ConnectionStages = Object.freeze({
  UNAUTH: Symbol(1),
  AUTHED: Symbol(2),
  REGED: Symbol(3),
  RUNNING: Symbol(4),
  DISCONNECTED: Symbol(5),
});

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
   * @param {AllAreaBroadcaster} broadcaster
   * @param {io} io - Socket.io object.
   * @param {ExtensionManager} extMan - Extension Manager object.
   * @param {MovementManagerServer} movementManager - Handles PlayerSyncMessage.
   * and player locations.
   * @param {Express.Express} app
   */
  constructor(dir, gameMap, authServer, broadcaster, io, extMan, movementManager, app) {
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

    this.setupE2s(app);
  }

  /**
   * Setup the callbacks for handling E2S API calls.
   */
  setupE2s(app) {
    const urlencodedParser = bodyParser.json();
    app.post('/e2s/:extId/:apiName', urlencodedParser, (req, res) => {
      this.handleE2s(res, req.params.extId, req.params.apiName, req.body);
    });
  }

  /**
   * Handle E2s call.
   */
  async handleE2s(res, extId, apiName, reqContent) {
    try {
      if (typeof reqContent !== 'object' || typeof reqContent.apiKey !== 'string' || reqContent.apiKey !== config.get('e2sApiKey')) {
        res.json({'error': 'Not authorized'});
        return;
      }
      const ret = await this.extMan.onE2sCalled(extId, apiName, reqContent.args);
      if (typeof msg === 'object' && msg !== null && 'error' in msg && typeof msg.error === 'string') {
        console.error(`e2s call error: ${msg.error}`);
      }
      res.json(ret);
    } catch (e) {
      console.error(`e2s call exception: ${e}`);
      res.json({'error': 'exception'});
    }
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
        const callArgs = {
          extName: extName,
          methodName: methodName,
          args: args,
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
      // We listen to the disconnect event here at the earliest point so that
      // onDisconnect() is always fired no matter when the connection is
      // dropped.
      socket.on('disconnect', (reason) => {
        this.onDisconnect(socket, reason);
        // onDisconnect is async, so returns immediately.
      });

      // Acquire this lock if you need to move the player or during connection/
      // disconnection.
      socket.moveLock = new AsyncLock();
      socket.stage = ConnectionStages.UNAUTH;

      socket.on('authenticate', (msg) => {
        // Note: This method MUST remain non-async so that there's no
        // await between checking socket.stage to setting socket.stage.
        if (socket.stage !== ConnectionStages.UNAUTH) {
          console.warn('Client tried to authenticate again: ', socket.stage, socket);
          this.notifyKicked(socket, 'Double authentication');
          return;
        }

        if (!('token' in msg)) {
          socket.emit('unauthorized', {data: 'No token found'});
          return;
        }
        if (typeof msg.token !== 'string') {
          socket.emit('unauthorized', {data: 'Token is not string'});
          return;
        }
        const verified = this.authServer.verifyToken(msg.token);
        if (verified === null) {
          socket.emit('unauthorized', {data: 'Token verification failed'});
          return;
        }

        // Socket is authenticated.
        socket.emit('authenticated', {});
        socket.decoded_token = verified;
        socket.stage = ConnectionStages.AUTHED;

        const kickIfConnected = (msg.kickIfConnected === true);
        try {
          this.addSocket(socket, kickIfConnected);
        } catch (e) {
          console.error('Exception in addSocket: ', e, e.stack);
        }
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
      console.error('Can\'t kick player: ', playerID);
      return false;
    }
    return await this.notifyKicked(this.socks[playerID], reason);
  }

  /**
   * Notify a player that the player have been kicked.
   */
  async notifyKicked(socket, reason) {
    // Note: Do not await on any code that waits for moveLock.
    // This method is free to be called by code that holds moveLock.
    socket.emit('kicked', reason);
    await new Promise((r) => setTimeout(r, 5000));
    socket.disconnect();
  }

  /**
   * Accept an authorized user's socket.
   * This is usually called by addUnauthSocket() above.
   * socket.decoded_token.uid should be populated and is the User ID.
   * @param {Socket} socket - The socket.io socket of the authorized user.
   */
  async addSocket(socket, kickIfConnected) {
    // This socket is authenticated, we are good to handle more events from it.

    // Note: We're locking the connection process while there's no code that
    // moves the player because we want ensure that the connection handler
    // (addSocket) does not run concurrent to the disconnection handler
    // (onDisconnect) and connection handler will always run til completion
    // before the disconnection handler have a chance to run.
    await socket.moveLock.acquire('move', async () => {
      const playerID = socket.decoded_token.sub;

      if (socket.stage !== ConnectionStages.AUTHED) {
        console.error('Weird race condition on socket.stage in addSocket(): ', socket.stage, playerID, socket);
        await this.notifyKicked(socket, 'Race in addSocket');
        return;
      }

      // Let everyone know we've accepted this player.
      let ret = await this.rpcHandler.registerPlayer(playerID);
      if (!ret) {
        // Player already connected.
        if (!kickIfConnected) {
          console.warn(`Player ${playerID} already connected and kickIfConnected=false`);
          await this.notifyKicked(socket, 'Duplicate connection');
          return;
        }

        // Try kick player.
        await this.kickRemotePlayer(playerID);
        // Try again in 0.5s.
        await new Promise((resolve) => setTimeout(resolve, 500));
        ret = await this.rpcHandler.registerPlayer(playerID);
        if (!ret) {
          await this.notifyKicked(socket, 'Duplicate connection');
          console.warn(`Player ${playerID} already connected but retry still failed`);
          return;
        }
      }

      // We're now registered.
      socket.stage = ConnectionStages.REGED;

      // Now we've acquired the ownership of this player, we're free to
      // load the player data.
      socket.playerData = await this.dir.getPlayerData(playerID);
      socket.playerID = playerID;

      // Notify the client about any previous data.
      socket.emit('previousData', PlayerSyncMessage.fromObject(socket.playerData));

      // Add it to our records.
      this.socks[playerID] = socket;

      if (socket.disconnected) {
        // Disconnected halfway.
        console.warn(`Player ${playerID} disconnected halfway through.`);
        // The rest would be handled by onDisconnect().
        return;
      }
      console.log(`Player ${playerID} connected.`);

      // Initialize the player data.
      const initLoc = socket.playerData.mapCoord ?? this.gameMap.getRandomSpawnPoint();
      socket.playerData.mapCoord = initLoc;
      socket.playerData.facing = 'D';
      socket.playerData.lastMovingTime = Date.now();
      socket.playerData.ghostMode = false;

      // notify the client to start the game after his/her avatar is selected
      socket.on('avatarSelect', async (msg) => {
        try {
          await this._onAvatarSelect(socket, msg);
        } catch (e) {
          console.error('Exception in avatarSelect: ', e, e.stack);
        }
      });
    });
  }

  /**
   * Handles the avatarSelect event.
   */
  async _onAvatarSelect(socket, msg) {
    // avatarSelect modifies the stage and moves the player.
    await socket.moveLock.acquire('move', async () => {
      if (socket.stage !== ConnectionStages.REGED) {
        console.warn('Duplicate avatarSelect: ', socket.playerData, socket.stage, socket);
        // Kick player for race condition.
        await this.notifyKicked(socket, 'Duplicated avatarSelect');
        return;
      }

      // initialize the appearance of player
      socket.playerData.displayName = msg.displayName;
      socket.playerData.displayChar = msg.displayChar;

      const firstLocation = PlayerSyncMessage.fromObject(socket.playerData);
      if (!firstLocation.check(this.gameMap.graphicAsset)) {
        // Kick player for invalid avatar args.
        await this.notifyKicked(socket, 'Invalid avatarSelect args');
        return;
      }

      // Occupy the player's current location .
      if (!firstLocation.ghostMode) await this._enterCoord(firstLocation.mapCoord);
      await this._broadcastPlayerUpdate(firstLocation);

      // Note that it is required that we do not have any away between
      // sendStateTransfer() to 'gameStart' emission
      this.broadcaster.sendStateTransfer(socket);

      // Emit the gameStart event.
      const startPack = {playerID: socket.playerData.playerID};
      socket.emit('gameStart', startPack);
      socket.stage = ConnectionStages.RUNNING;

      // Player is now free to move around after the first location have been
      // broadcasted and the game start event have been emitted.
      socket.on('playerUpdate', (msg) => {
        this.onPlayerUpdate(socket, PlayerSyncMessage.fromObject(msg));
        // onPlayerUpdate is async, so returns immediately.
      });

      // Start accepting extension calls from the client.
      socket.on('callC2sAPI', (msg, callback) => {
        this._onCallC2sAPI(socket, msg, callback);
      });
    });
  }

  /**
   * Called on callS2cAPI event.
   */
  _onCallC2sAPI(socket, msg, callback) {
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
  }

  /**
   * Called when the user disconnects.
   * @param {Socket} socket - The socket that disconnected.
   * @param {reason} reason - The reason why we disconnected.
   */
  async onDisconnect(socket, reason) {
    await socket.moveLock.acquire('move', async () => {
      if (socket.stage === ConnectionStages.DISCONNECTED) {
        // Should not happen, nobody calls it twice.
        console.error('Concurrent onDisconnect(): ', socket);
      } else if (socket.stage === ConnectionStages.UNAUTH ||
                 socket.stage === ConnectionStages.AUTHED) {
        console.info('Player disconnected without joining the game: ', socket);
        // Nothing needs to be done, they've not yet registered.
      } else if (socket.stage === ConnectionStages.REGED ||
                 socket.stage === ConnectionStages.RUNNING) {
        const playerID = socket.decoded_token.sub;
        if (!(playerID in this.socks)) {
          // This should not happen.
          console.error(`Player ${playerID} is non-existent when disconnected.`);
        } else if (this.socks[playerID] !== socket) {
          // This should not happen.
          console.error(`Player ${playerID}'s socket mismatch when disconnected.`);
        } else {
          delete this.socks[playerID];
        }

        const lastLocation = PlayerSyncMessage.fromObject({playerID, removed: true});
        await this._broadcastPlayerUpdate(lastLocation);

        // If we're in REGED state, then we've not taken the coordinate
        // and is still waiting for avatar select.
        if (socket.stage === ConnectionStages.RUNNING) {
          // release grid after disconnection
          if (!socket.playerData.ghostMode) await this._leaveCoord(socket.playerData.mapCoord);
        }

        // Try to unregister the player.
        await this.rpcHandler.unregisterPlayer(playerID);
        // Note: After this point, the player is free to reconnect.

        socket.stage = ConnectionStages.DISCONNECTED;

        console.log(`Player ${playerID} disconnected`);
      } else {
        console.error('Unknown stage for connection in onDisconnect: ', socket);
      }
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
      this.movementManager.recvPlayerMoveMessage(this, socket, updateMsg, failOnPlayerUpdate.bind(this));
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
      const player = socket.playerData;

      // If the player doesn't move at all, just return true.
      if (player.mapCoord.equalsTo(msg.mapCoord) && player.ghostMode === msg.ghostMode) {
        return true;
      }

      // If the player wants his/her next status is in ghost mode, ignore occupation check and no need to enterCoord().
      if (msg.ghostMode) {
        // empty
      } else {
        // Teleport the player to the target position anyhow.
        const ret = await this._enterCoord(msg.mapCoord);

        // If overlap is not allowed, check if the moving is legal.
        if (!allowOverlap && !ret) {
          await this._leaveCoord(msg.mapCoord);
          return false;
        }
      }

      // If the previous status is in ghost mode, no need to leave coord.
      // Otherwise, release the previous coordination.
      if (!player.ghostMode) {
        await this._leaveCoord(socket.playerData.mapCoord);
      }

      // Everything seems well. Broadcast new location.
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
   * Warning: A player in ghost mode SHOULD NOT occupy any coordinate!
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
   * Warning: A player in ghost mode SHOULD NOT call this function when moving!
   * Clear a player's occupation record of the mapCoord.
   * @param {MapCoord} mapCoord
   */
  async _leaveCoord(mapCoord) {
    await this.dir.getRedis().decrAsync([mapCoord.toRedisKey()]);
  }
}

export default GatewayService;
