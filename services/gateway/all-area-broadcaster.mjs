// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import GameState from '../../common/maplib/game-state.mjs';

/**
 * AllAreaBroadcaster is in charge of broadcasting all player location and
 * other game state.
 */
class AllAreaBroadcaster {
  /**
   * Create the all area broadcaster.
   * @constructor
   * @param {io} io - Socket.io object.
   * @param {Directory} dir - RPC Directory.
   * @param {GameMap} gameMap - The game map.
   */
  constructor(io, dir, gameMap) {
    this.io = io;
    this.dir = dir;
    this.gameMap = gameMap;
    // redis channel on which we broadcast the messages.
    this.gameStateChannel = 'gameState';
    // GameState object for storing the game state/player location.
    this.gameState = new GameState(gameMap);
  }
  
  /**
   * Initialize the AllAreaBroadcaster.
   */
  async initialize() {
    this.dir.getRedisSub().on('message', (channel, message) => {
      if (channel === this.gameStateChannel) {
        let loc = message;
        if (typeof message === 'string') {
          loc = JSON.parse(message);
        }
        this.onLocation(loc);
      }
    });
    await this.dir.getRedisSub().subscribeAsync(this.gameStateChannel);
  }

  /**
   * Call this to notify player location change. This will send data to redis.
   * @param {object} loc - The location object, see Gateway Service for doc.
   */
  async notifyPlayerLocationChange(loc) {
    this.gameState.onLocation(loc);
    await this.dir.getRedis().publishAsync(this.gameStateChannel,
        JSON.stringify(loc));
  };
  
  /**
   * This is called when we've a location message from redis.
   * @param {object} loc - The location object, see Gateway Service for doc.
   */
  onLocation(loc) {
    // Broadcast the location message.
    this.io.emit('location', loc);
  }
  
  /**
   * Do a state transfer for the specified socket.
   * It'll emit a message that contains all the current state, intending
   * to synchronize the client's state to match the server's.
   * This is usually called once on startup.
   * @param {socket} socket - The socket to send the state.
   */
  sendStateTransfer(socket) {
    // TODO: Deal with potential race condition.
    // We transfer the state at this moment, but some previous 'location' might
    // still be in the pipeline, resulting in duplicated messages delivered.
    // NOTE: We might need to filter the player data.
    let players = this.gameState.getPlayers();
    socket.emit('stateTransfer', players);
  }

  /**
   * Return the GameState object.
   * @return {GameState} gameState - The GameState object.
   */
  gameState() {
    return this.gameState;
  }
};

export default AllAreaBroadcaster;
