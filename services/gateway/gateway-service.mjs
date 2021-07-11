// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

import assert from 'assert';
const {Server} = require('socket.io');
const config = require('config');
const moveingRequestThreshold = config.get('movingRequestThreshold')
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
   * @param {AllAreaBroadcaster} broadcaster - The broadcaster of game state
   * and player locations.
   */
  constructor(dir, gameMap, authServer, broadcaster, extMan) {
    this.dir = dir;
    this.gameMap = gameMap;
    this.authServer = authServer;
    this.broadcaster = broadcaster;
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
  async initialize() {
    this.rpcHandler = await this.dir.registerService("gatewayServer");
    this.extMan.setRpcHandlerFromGateway(this.rpcHandler);
    await this.rpcHandler.registerAsGateway();
    this.rpcHandler.registerRPC('callS2c', this.callS2c.bind(this));
    this.servers = [];
    await this.extMan.createAllInGateway(this.rpcHandler, this);
    await this.extMan.startAllInGateway();
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
    firstLocation.x = socket.playerData.x;
    firstLocation.y = socket.playerData.y;
    firstLocation.facing = 'D';
    firstLocation.displayChar = socket.playerData.displayChar;
    socket.playerData.lastMovingTime = Date.now();
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
    async onUserLocation(socket, msg) {
    msg.playerID = socket.playerID;
    msg.displayName = socket.playerData.displayName;
    msg.displayChar = socket.playerData.displayChar;
    // TODO: Check if facing is valid.
    // TODO: Check if movement is legal.

    let mapSize = this.gameMap.getMapSize();
    let lastMsg = { x:socket.playerData.x , y:socket.playerData.y}
    if(lastMsg.x === undefined || lastMsg.y === undefined){
      lastMsg.x = 0;
      lastMsg.y = 0;
    }
    if(!this._movementRequestSpeedCheck(socket.playerData)){
      return;
    }
    // target position is in the map
    if(!this._borderCheck(msg,mapSize)){
      // restrict user position
      msg.x = lastMsg.x;
      msg.y = lastMsg.y;
      await this._broadcastUserLocation(msg);
      return;
    }

    // near by grid check  
    if(!this._nearByGridCheck(msg,lastMsg)){
      return ;
    }
    //try occupy grid
    let ret = await this.dir.redis.setAsync(
      [`${msg.x}-${msg.y}`, 'occupied', 'NX']);
    // grid has be occupied
    if(ret === null){
      // restrict user position
      msg.x = lastMsg.x;
      msg.y = lastMsg.y;
      await this._broadcastUserLocation(msg);
      return;
    }
    
    //release old grid 
    socket.playerData.lastMovingTime = Date.now();
    await this.dir.redis.delAsync(`${lastMsg.x}-${lastMsg.y}`);
    await this._broadcastUserLocation(msg);
    return;
   
  }

  /**
   * Broadcast the user's location and direction.
   * @private
   * @param {Object} msg - The location message.
   * @return {Boolean} success - true if successful.
   */
  async _broadcastUserLocation(msg) {
    if (msg.playerID in this.socks) {
      const playerData = this.socks[msg.playerID].playerData;
      playerData.mapCoord = msg.mapCoord;
      await this.dir.setPlayerData(msg.playerID, playerData);
    }
    await this.broadcaster.notifyPlayerLocationChange(msg);
    return true;
  }

  _getDistanceSquare(a,b){
    return Math.pow(Math.abs(a.x - b.x),2) + Math.pow(Math.abs(a.y - b.y),2);
  }

  _borderCheck(msg,mapSize,mapShift){
    if(msg.x > mapSize.width || msg.x < 0){
      return false;
    }
    if(msg.y > mapSize.height || msg.y < 0){
      return false;
    }
    return true;
  }

  _nearByGridCheck(msg,lastRecord){
    let lastPosition = {x:lastRecord.x , y:lastRecord.y};
    let targetPosition = {x:msg.x , y:msg.y};
    let distanceSquire = this._getDistanceSquare(lastPosition,targetPosition);
    if(distanceSquire > 1){
      return false;
    } 
    return true;
  }

  _movementRequestSpeedCheck(playerData){
    if(playerData.lastMovingTime === undefined){
      console.log('player has no last time record')
      return false;
    }
    if( Date.now() - playerData.lastMovingTime < moveingRequestThreshold){
      return false;
    }
    return true;
  }
}

export default GatewayService;
