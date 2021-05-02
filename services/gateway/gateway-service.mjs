// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

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
    void dir;
    assert.fail('Not implemented');
  }

  /**
   * Initialize the gateway service.
   * At the time this is called, other services and extensions have been
   * created, but their initialize() have not been called.
   */
  initialize() {
    assert.fail('Not implemented');
  }

  /**
   * Add a new socket.io server to this service.
   * This is typtically called by the main class/function.
   * @param {EventEmitter} server - The socket.io server to add to this class.
   */
  addServer(server) {
    void server;
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
  addUnauthSocket(socket) {
    void socket;
    assert.fail('Not implemented');
  }

  /**
   * Accept an authorized user's socket.
   * This is usually called by addUnauthSocket() above.
   * socket.decoded_token.uid should be populated and is the User ID.
   * @param {Socket} socket - The socket.io socket of the authorized user.
   */
  addSocket(socket) {
    void socket;
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
  async broadcastUserLocation(uid, x, y, facing) {
    void [uid, x, y, facing];
    assert.fail('Not implemented');
    return false;
  }
}

export default GatewayService;
