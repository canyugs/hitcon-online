// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import { Server } from "socket.io";
import { redis } from "redis";

import { RPCDirectory } from "../../common/rpc-directory"
import { map } from "../../common/maplib"
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
   * @param {RPCDirectory} dir - The RPCDirectory for calling other services.
   */
  constructor(dir) {
    this.dir = dir;
    assert.fail('Not implemented');
  }

  /**
   * Initialize the gateway service.
   * At the time this is called, other services and extensions have been
   * created, but their initialize() have not been called.
   */
  initialize() {
    this.dir.register("getewayServer");
    this.servers = [];
    this.publisher = redis.createClient();
    assert.fail('Not implemented');
  }

  /**
   * Add a new socket.io server to this service.
   * This is typtically called by the main class/function.
   * @param {Server} server - The socket.io server to add to this class.
   */
  addServer(server) {
    this.servers.push(server);
    server
    .on('connection', socketioJwt.authorize({
      secret: 'your secret or public key',
      timeout: 15000 
    }))
    .on('authenticated', (socket) => {
      addSocket(socket);
     
    })
    .on('location',(socket)=>{
      onUserLocation(socket);
      
    });

    assert.fail('Not implemented');
  }

  /**
   * Accept an authorized user's socket.
   * This is usually called by addUnauthSocket() above.
   * socket.decoded_token.uid should be populated and is the User ID.
   * @param {Socket} socket - The socket.io socket of the authorized user.
   */
  addSocket(socket) {
    //this socket is authenticated, we are good to handle more events from it.
    console.log(`hello! ${socket.decoded_token.name}`);
    assert.fail('Not implemented');
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

    this.publisher.publish("updateUserPosition",{uid:uid,x:x,y:y,facing:facing});

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
    return map.getCell(x,y);
  }
}

export default GatewayService;
