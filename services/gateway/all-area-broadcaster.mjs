// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import GameState from '../../common/maplib/game-state.mjs';

/**
 * AllAreaBroadcaster is in charge of broadcasting all player location and
 * other game state.
 */
class AllAreaBroadcaster {
  // redis channel on which we broadcast the messages.
  static gameStateChannel = 'gameState';

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
    this.gameStateChannel = AllAreaBroadcaster.gameStateChannel;
    // GameState object for storing the game state/player location.
    this.gameState = new GameState(gameMap);
  }

  /**
   * Initialize the AllAreaBroadcaster.
   */
  async initialize() {
    this.dir.getRedisSub().on('message', (channel, message) => {
      if (channel === this.gameStateChannel) {
        let obj = message;
        if (typeof message === 'string') {
          obj = JSON.parse(message);
        }
        if (obj.type == 'loc') {
          this.onLocation(obj.msg);
        } else if (obj.type == 'extBC') {
          this.onExtensionBroadcast(obj.msg);
        } else if (obj.type == 'cset') {
          this.onCellSetBroadcast(obj.msg);
        }
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
    let msg = {type: 'loc', msg: loc};
    await this.dir.getRedis().publishAsync(this.gameStateChannel,
        JSON.stringify(msg));
  }

  /**
   * Call this to notify player cell set change. This will send data to redis.
   * @param {object} cset - The cell set object, see Gateway Service for doc.
   */
  async notifyPlayerCellSetChange(cset) {
    this.gameState.onCellSet(cset);
    let msg = {type: 'cset', msg: cset};
    await this.dir.getRedis().publishAsync(this.gameStateChannel,
        JSON.stringify(msg));
  }

  /**
   * Broadcast a message for extension.
   * @param {object} msg - The message.
   */
  async broadcastExtensionMessage(msg) {
    await this.dir.getRedis().publishAsync(this.gameStateChannel,
        JSON.stringify({type: 'extBC', msg: msg}));
  }

  /**
   * This is called when we've a location message from redis.
   * @param {object} loc - The location object, see Gateway Service for doc.
   */
  onLocation(loc) {
    // Broadcast the location message.
    this.io.emit('location', loc);
  }

  /**
   * This is called when we've an extension broadcast from redis.
   * @param {object} bc - The broadcast message.
   */
  onExtensionBroadcast(bc) {
    // Broadcast the extension broadcast.
    this.io.emit('extBC', bc);
  }

  /**
   * This is called when we've a cell set modification broadcast from redis.
   * @param {object} cset - The cell set.
   */
  onCellSetBroadcast(cset) {
    // Broadcast the cell set modification.
    this.io.emit('cset', cset);
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
    let state = this.gameState.getStateTransfer();
    socket.emit('stateTransfer', state);
  }

  /**
   * Return the GameState object.
   * @return {GameState} gameState - The GameState object.
   */
  gameState() {
    return this.gameState;
  }
}

export default AllAreaBroadcaster;
