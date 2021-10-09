// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {checkPlayerMove} from '/static/common/gamelib/move-check.mjs';
import {PlayerSyncMessage} from '/static/common/gamelib/player.mjs';
import {MapCoord} from '/static/common/maplib/map.mjs';

/**
 * TODO: jsdoc
 */
class MovementManager {
  /**
   * Construct a movement manager
   * @constructor
   * @param {Socket} socket - A socket.io socket.
   * @param {InputManager} inputManager
   */
  constructor(socket, inputManager) {
    this.socket = socket;
    this.inputManager = inputManager;

    this.gameClient = null;
    window.addEventListener('dataReady', (event) => {
      this.gameClient = event.detail.gameClient;

      this.inputManager.registerMapMove((direction) => {
        const dx = {'U': 0, 'D': 0, 'L': -1, 'R': 1}[direction];
        const dy = {'U': 1, 'D': -1, 'L': 0, 'R': 0}[direction];
        const {x, y} = this.gameClient.playerInfo.mapCoord;
        this.moveTo(x + dx, y + dy, direction);
      });
    });
  }

  /**
   * Emit message of moving to a location.
   * @param {Number} x
   * @param {Number} y
   * @param {String} facing
   */
  moveTo(x, y, facing) {
    const player = this.gameClient.playerInfo;
    const msg = PlayerSyncMessage.fromObject({
      playerID: player.playerID,
      mapCoord: new MapCoord(player.mapCoord.mapName, x, y),
      facing: facing,
    });
    if (!checkPlayerMove(player, msg, this.gameClient.gameMap)) {
      return;
    }
    player.lastMovingTime = Date.now();
    this.socket.emit('playerUpdate', msg);
  }
}

export default MovementManager;
