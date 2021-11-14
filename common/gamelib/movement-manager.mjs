// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {checkPlayerMove, getPlayerMoveCooldown} from './move-check.mjs';
import {PlayerSyncMessage} from './player.mjs';
import {MapCoord} from '../maplib/map.mjs';

const ERROR_COOLDOWN_MS = 300;

/**
 *TODO: jsdoc
 */
class MovementManagerServer {
  /**
   * TODO: jsdoc
   */
  constructor() {
    this.playerMovingTimer = new Map();
  }

  /**
   * TODO: jsdoc
   * @param {GateWayService} gs
   * @param {Socket} socket
   * @param {PlayerSyncMessage} updateMsg
   * @param {Function} failOnPlayerUpdate
   */
  async handlePlayerMove(gs, socket, updateMsg, failOnPlayerUpdate) {
    const player = socket.playerData;

    // If the update message comes too early, handles it later.
    if (getPlayerMoveCooldown(player) > 0) {
      // We reserve only one moving request per player.
      if (this.playerMovingTimer.has(player.playerID)) {
        clearTimeout(this.playerMovingTimer.get(player.playerID));
      }
      // Handle the moving request later.
      setTimeout((gs, socket, updateMsg, failOnPlayerUpdate) => {
        this.handlePlayerMove(gs, socket, updateMsg, failOnPlayerUpdate);
      }, Math.max(getPlayerMoveCooldown(player), 0), gs, socket, updateMsg, failOnPlayerUpdate);
      return;
    }

    // clean up the timer
    this.playerMovingTimer.delete(player.playerID);

    if (!checkPlayerMove(player, updateMsg, gs.gameMap)) {
      failOnPlayerUpdate();
      return;
    }

    if (!(await gs._teleportPlayerInternal(socket, updateMsg, false))) {
      failOnPlayerUpdate();
      return;
    }
  }
}


/**
 * TODO: jsdoc
 */
class MovementManagerClient {
  /**
   * Construct a movement manager
   * @constructor
   * @param {Socket} socket - A socket.io socket.
   * @param {GameState} gameState
   * @param {InputManager} inputManager
   * @param {MapRenderer} mapRenderer
   */
  constructor(socket, gameState, inputManager, mapRenderer) {
    this.socket = socket;
    this.gameState = gameState;
    this.inputManager = inputManager;
    this.mapRenderer = mapRenderer;

    this.gameClient = null;
    window.addEventListener('dataReady', (event) => {
      this.gameClient = event.detail.gameClient;

      this.inputManager.registerMapMove((direction) => {
        const dx = {'U': 0, 'D': 0, 'L': -1, 'R': 1}[direction];
        const dy = {'U': 1, 'D': -1, 'L': 0, 'R': 0}[direction];
        const {x, y} = this.gameClient.playerInfo.mapCoord;
        this.moveTo(x + dx, y + dy, direction, inputManager.pressedKeys.has('g'));
      });

      // ghost mode
      this.inputManager.registerKeydownOnce(mapRenderer.canvas, (event) => {
        if (event.key !== 'g') return;
        const {mapCoord: {x, y}, facing} = this.gameClient.playerInfo;
        this.moveTo(x, y, facing, true);
      });
      this.inputManager.registerKeyup(mapRenderer.canvas, (event) => {
        if (event.key !== 'g') return;
        const {mapCoord: {x, y}, facing} = this.gameClient.playerInfo;
        this.moveTo(x, y, facing, false);
      });
    });

    this.clientTime = 0;
    this.serverTime = 0;

    this.errorCooldown = false;

    this.gameState.clientPlayerUpdateInjectedFunction = this.updateFromServer.bind(this);
  }

  /**
   * Called when an update message is not successful.
   */
  _setErrorCooldown() {
    if (this._errorCooldownTimer !== undefined) {
      clearTimeout(this._errorCooldownTimer);
    }
    this.errorCooldown = true;
    this._errorCooldownTimer = setTimeout(() => {
      this.errorCooldown = false;
      this._errorCooldownTimer = undefined;
    }, ERROR_COOLDOWN_MS);
  }

  /**
   * Handles the update message from server.
   * @param {PlayerSyncMessage} msg
   * @return {String}
   */
  updateFromServer(msg) {
    // don't care when the server is not yet initialized
    if (!this.gameClient) {
      return 'continue';
    }

    const player = this.gameClient.playerInfo;

    // right here we only care about main player's movement
    if (msg.playerID !== player.playerID) {
      return 'continue';
    }

    // return if the message is outdated
    if (msg.clientTime && (msg.clientTime < this.serverTime)) {
      return 'abort';
    }

    this.serverTime = (msg.clientTime ?? (this.clientTime - 1)) + 1;

    // ignore this message if it is a notification about previous success
    if (msg.updateSuccess) {
      return 'abort';
    }

    // The update at msg.clientTime is not successful, revert it.
    this._setErrorCooldown();
    player.updateFromMessage(msg, 'both');

    return 'updated';
  }

  /**
   * Emit message of moving to a location.
   * @param {Number} x
   * @param {Number} y
   * @param {String} facing
   * @param {Boolean} ghostMode
   */
  moveTo(x, y, facing, ghostMode) {
    // If moving error occurred recently, don't move.
    // This is a temporary workaround. Better solution will be:
    // * server drop all the pending request when moving error occurs
    // * client reset this.clientTime upon receiving unsuccessful update
    // * server accepts only update message with new msg.clientTime
    if (this.errorCooldown) {
      return;
    }

    const player = this.gameClient.playerInfo;
    const msg = PlayerSyncMessage.fromObject({
      playerID: player.playerID,
      mapCoord: new MapCoord(player.mapCoord.mapName, x, y),
      facing: facing,
      ghostMode: ghostMode,
    });
    // TODO: If (player.lastMovingTimeClient - player.lastMovingTime) too large, return.
    // This is the situation where the time delay between client and server becomes too large.
    if (!checkPlayerMove(player, msg, this.gameClient.gameMap, true)) {
      return;
    }
    msg.clientTime = this.clientTime++;
    player.updateFromMessage(msg, 'client'); // Client-side prediction. If error occurs, this update will be reverted in this.updateFromServer()
    this.socket.emit('playerUpdate', msg);
  }
}

export {
  MovementManagerServer,
  MovementManagerClient,
};
