// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * The game client. This is in charge of interacting with the gateway service
 * on the server side.
 */
class GameClient {
  /**
   * Create a game client.
   * @param {Socket} socket - A socket.io socket.
   * @param {GameState} gameState - The map state object for tracking the map
   * state.
   * @constructor
   */
  constructor(socket, gameState) {
    this.socket = socket;
    this.gameState = gameState;
    // This function is called if server disconnects us or if any fatal
    // error occurs.
    this.disconnectCallback = undefined;
  }

  /**
   * Register the callback for disconnect event.
   * @param {function} callback - The callback for disconnect event.
   */
  registerDisconnectCallback(callback) {
    this.disconnectCallback = callback;
  }

  /**
   * Initialize the game client by connecting to the server.
   * @param {string} token - The token to authorize ourself.
   */
  async initialize(token) {
    this.token = token;
    let socket = this.socket;
    socket.on('connect', () => {
      socket.emit('authenticate', {token: token});
      socket.on('authenticated', () => {
        console.log('Authenticated!');
        // We need to wait for the gameStart event.
      });
      socket.on('unauthorized', (msg) => {
        console.error(`Authorization failed: ${JSON.stringify(msg.data)}`);
        this.onDisconnect();
      });
      socket.on('gameStart', (msg) => {
        this.onStartup(msg);
      });
    });
  }

  /**
   * This is called when we're authenticated, and ready to start the game.
   */
  async onStartup() {
    console.log('Game starting');
  }

  /**
   * Return the GameState object. This will allow the caller to query the
   * current state of the map.
   * @return {GameState} gameState - The GameState object.
   */
  GameState() {
    return this.gameState;
  }
}

export default GameClient;
