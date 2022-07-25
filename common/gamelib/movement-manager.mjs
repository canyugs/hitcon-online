// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {checkPlayerMove, getPlayerMoveCooldown, checkOccupationOnClient, movementLogger} from './move-check.mjs';
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
    this.messageCounter = 0;
    this.pendingMessages = new Map();
  }

  /**
   * TODO: jsdoc
   * @param {GateWayService} gs
   * @param {Socket} socket
   * @param {PlayerSyncMessage} updateMsg
   * @param {Function} failOnPlayerUpdate
   */
  recvPlayerMoveMessage(gs, socket, updateMsg, failOnPlayerUpdate) {
    const player = socket.playerData;
    // make sure there is an entry
    if (!this.pendingMessages.has(player.playerID)) {
      this.pendingMessages.set(player.playerID, []);
    }

    const queue = this.pendingMessages.get(player.playerID);
    const args = [this.messageCounter++, gs, socket, updateMsg, failOnPlayerUpdate];
    queue.push(args);

    // If there is only one message pending, process it now.
    // Otherwise, the processing of this updateMsg will be launched by this.processPlayerMoveMessage().
    if (queue.length === 1) {
      this.processPlayerMoveMessage(...args);
    }
  }

  /**
   * TODO: jsdoc
   * @param {Number} messageCounter
   * @param {GateWayService} gs
   * @param {Socket} socket
   * @param {PlayerSyncMessage} updateMsg
   * @param {Function} failOnPlayerUpdate
   * @param {Boolean} postponed - a debugging information indicating whether this function is called by setTimeout
   */
  async processPlayerMoveMessage(messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, postponed=false) {
    // We need to make this section atomic. Otherwise, the (await gs._teleportPlayerInternal) will
    // have race condition when multiple updateMsg come simultaneously.
    await socket.moveLock.acquire('handlePlayerMove', async () => {
      const player = socket.playerData;
      movementLogger.debug('----------------------------');
      movementLogger.debug(`receives player move${postponed ? ' postponed' : ''}`);
      movementLogger.debug(player.mapCoord.toJSON());
      movementLogger.debug(updateMsg.mapCoord.toJSON());

      // If the update message comes too early, handle it later.
      if (getPlayerMoveCooldown(player) > 0) {
        movementLogger.debug(`- comes too early by ${getPlayerMoveCooldown(player)} ms`);
        setTimeout((messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, postponed) => {
          this.processPlayerMoveMessage(messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, postponed);
        }, Math.max(getPlayerMoveCooldown(player), 0), messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, true);
        return;
      }

      // Otherwise, handle the message now.

      let success = true;
      if (!checkPlayerMove(player, updateMsg, gs.gameMap)) {
        movementLogger.debug('- error on check player move');
        failOnPlayerUpdate();
        success = false;
      }

      if (success && !(await gs._teleportPlayerInternal(socket, updateMsg, false))) {
        movementLogger.debug('- error on teleport internal');
        failOnPlayerUpdate();
        success = false;
      }

      const pending = this.pendingMessages.get(player.playerID);
      if (success) {
        // If the message is processed successfully, delete it from pending array.
        // TODO: test if the performance is better when using object/map/set
        // (though I believe that array would be the fastest since pending.length is likely
        // to be very small, say, smaller than 3)
        for (let i = 0; i < pending.length; ++i) {
          if (pending[i][0] === messageCounter) {
            pending.splice(i, 1);
            break;
          }
        }
      } else {
        // If the message fails to be processed, clear the pending array since
        // the pending messages may turn out to be errors.
        pending.length = 0;
      }

      // If there is still any element in pending array, pick the one which comes first and process it.
      if (pending.length > 0) {
        let mini = 0;
        for (let i = 1; i < pending.length; ++i) {
          if (pending[i][0] < pending[mini][0]) {
            mini = i;
          }
        }
        setTimeout((messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, postponed) => {
          this.processPlayerMoveMessage(messageCounter, gs, socket, updateMsg, failOnPlayerUpdate, postponed);
        }, Math.max(getPlayerMoveCooldown(player), 0), ...pending[mini]);
      }

      movementLogger.debug('end');
    });
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
    // The below attribute is different from GameClient.playerInfo.ghostMode.
    // GameClient stores the server's status and only updates by the messages from the server.
    // The this.ghostMode here stores the client's status and is modified on InputManager's message.
    this.ghostMode = false;

    this.gameClient = null;
    window.addEventListener('dataReady', (event) => {
      this.gameClient = event.detail.gameClient;

      this.inputManager.registerMapMove((direction) => {
        const dx = {'U': 0, 'D': 0, 'L': -1, 'R': 1}[direction];
        const dy = {'U': 1, 'D': -1, 'L': 0, 'R': 0}[direction];
        const {x, y} = this.gameClient.playerInfo.mapCoord;
        this.moveTo(x + dx, y + dy, direction, this.ghostMode);
      });

      // ghost mode
      this.inputManager.registerKeydownOnce(mapRenderer.getInputEventDOM(), (event) => {
        if (event.key !== 'g') return;
        this.ghostMode = true;
        const {mapCoord: {x, y}, facing} = this.gameClient.playerInfo;
        this.moveTo(x, y, facing, this.ghostMode);
      });
      this.inputManager.registerKeyup(mapRenderer.getInputEventDOM(), (event) => {
        if (event.key !== 'g') return;
        this.ghostMode = false;
        const {mapCoord: {x, y}, facing} = this.gameClient.playerInfo;
        this.moveTo(x, y, facing, this.ghostMode);
      });
      this.inputManager.registerJoyStickGhostModeButton((ghostMode) => {
        this.ghostMode = ghostMode;
        const {mapCoord: {x, y}, facing} = this.gameClient.playerInfo;
        this.moveTo(x, y, facing, this.ghostMode);
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
      return 'updated';
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
    // If the player was in ghost mode, don't check occupation.
    // Else if the player wants to enter ghost mode, don't check occupation either.
    // Else, check occupation.
    // The logic should be the same as `_teleportPlayerInternal()` in gateway-service.mjs.
    if (!player.ghostMode && !ghostMode && !checkOccupationOnClient(msg.mapCoord, this.gameState)) {
      return;
    }

    this.sendPlayerUpdateInternal(msg);
  }

  /**
   * Send a message and update clientTime.
   */
  sendPlayerUpdateInternal(msg) {
    msg.clientTime = this.clientTime++;
    const player = this.gameClient.playerInfo;
    player.updateFromMessage(msg, 'client'); // Client-side prediction. If error occurs, this update will be reverted in this.updateFromServer()
    this.socket.emit('playerUpdate', msg);
  }
}

export {
  MovementManagerServer,
  MovementManagerClient,
};
