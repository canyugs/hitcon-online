// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import { Server } from "socket.io";
import { RPCDirectory } from "../../common/rpc-directory"
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
   * This is called after accepting a socket.io connection.
   * Usually called by server.on('connection') or by external user who wants to
   * inject a connection.
   * The connection is not authorized yet and need to be authenticated by
   * socketio-jwt.
   * @param {Socket} socket - The socket.io socket.
   */
  addUnauthSocket(socket) {// this may be not necessary
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
    // todo : store user location in server
    this.dir.callRPC("","");
    this.broadcastUserLocation(socket,msg);
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
    socket.broadcast.emit("location",{uid:uid,x:x,y:y,facing:facing});
    //void [uid, x, y, facing];
    assert.fail('Not implemented');
    return false;
  }
}

export default GatewayService;
