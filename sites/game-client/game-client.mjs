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
    void socket;
    console.error('Not implemented.');
  }

  /**
   * Return the GameState object. This will allow the caller to query the
   * current state of the map.
   * @return {GameState} gameState - The GameState object.
   */
  GameState() {
    console.error('Not implemented.');
    return undefined;
  }
}

export default GameClient;
