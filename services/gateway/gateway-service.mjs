// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

import assert from 'assert';
const {Server} = require('socket.io');
const config = require('config');

import { get } from 'http';
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
   * @param {Map} gameMap - The world map for this game.
   * @param {AuthServer} authServer - Auth server for verifying the token.
   */
  constructor(dir, gameMap, authServer) {
    this.dir = dir;
    this.gameMap = gameMap;
    this.authServer = authServer;
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
    await this.rpcHandler.registerAsGateway();
    this.servers = [];
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

    // Register all events.
    socket.on('location', (location) => {
      this.onUserLocation(location);
      // onUserLocation is async, so returns immediately.
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

    // Emit the gameStart event.
    let startPack = {playerData: {}};
    for (const k in ['playerName', 'displayName', 'displayChar', 'x', 'y']) {
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
      // Shouldn't happen.
      console.assert(`Player ${playerID} is non-existent when disconnected.`);
    }
    // Try to unregister the player.
    await this.rpcHandler.unregisterPlayer(playerID);
    if (this.socks[playerID] !== socket) {
      console.error(`Player ${playerID}'s socket mismatch when disconnected.`);
    }
    delete this.socks[playerID];
    console.log(`Player ${playerID} disconnected`);
  }

  /**
   * Callback for the location message from the client. i.e.
   * socket.on('location')
   * @param {String} uid - The User ID.
   * @param {Object} msg - The location message. It includes the following:
   * - x: The x coordinate
   * - y: The y coordinate
   * - facing: One of 'U', 'D', 'L', 'R'. The direction the user is facing.
   */
  async onUserLocation(uid, msg) {
    // todo : checking movement is ligal
    // 取出uid 上一個位置
    // 計算距離< 最大可移動距離
    // 確認目標點是可以走的
    let speed = 1; // this can be adjust later

    let positionA = this.getLastPosition(uid)
    let positionB = {x:msg.x,y:msg.y};
    let distanceSquire = this.getDistanceSquare(positionA,positionB);

    //overspeed , are you fly?
    if(distanceSquire > speed ^ 2){
      this.broadcastResetUser(socket,uid,positionA.x,positionA.y,positionA.facing)
      return
    }

    //enter none empty grid
    if(this.checkPositionEmpty(positionB)){
      this.broadcastResetUser(socket,uid,positionA.x,positionA.y,positionA.facing)
      return
    }

    // todo : store user location in server

    //this.broadcastUserLocation(socket,msg);
  }

  /**
   * Broadcast the user's location and direction.
   * @private
   * @param {String} uid - User ID
   * @param {Number} x - X coordinate
   * @param {Number} y - Y coordinate
   * @param {String} facing - 'U', 'D', 'L', 'R', the direction user's facing.
   * @return {Boolean} success - true if successful.
   */
  async broadcastUserLocation(socket , uid, x, y, facing) {
    assert.fail('Not implemented');

    // TODO: Enable this after we have redis ready.
    //this.publisher.publish("updateUserPosition",{uid:uid,x:x,y:y,facing:facing});

    // there are some logic for calling extendsion api
    socket.broadcast.emit("location",{uid:uid,x:x,y:y,facing:facing});
    return false;
  }

  async broadcastResetUser(socket , uid, x, y, facing){
    socket.broadcast.emit("location",{uid:uid,x:x,y:y,facing:facing});
  }

  getLastPosition(uid){
    assert.fail('Not implemented');
    return {x:0,y:0,facing:'up'}
  }

  updatePosition(uid,x,y,facing){
    assert.fail('Not implemented');
  }

  getDistanceSquare(a,b){
    return Math.abs(a.x - b.x)^2 + Math.abs(a.y - b.y)^2
  }

  checkPositionEmpty(x,y){
    return gameMap.getCell(x,y);
  }
}

export default GatewayService;
