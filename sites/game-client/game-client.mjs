// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {Player, PlayerSyncMessage} from '/static/common/gamelib/player.mjs';
import {MapCoord} from '/static/common/maplib/map.mjs';

/**
 * The game client. This is in charge of interacting with the gateway service
 * on the server side.
 */
class GameClient {
  /**
   * Create a game client.
   * @param {Socket} socket - A socket.io socket.
   * @param {GameState} gameState - The map state object for tracking the map
   * @param {MapRenderer} mapRenderer
   * @param {InputManager} inputManager
   * @param {ClientExtensionManager} extMan
   * state.
   * @constructor
   */
  constructor(socket, gameState, mapRenderer, inputManager, extMan, mainUI) {
    this.socket = socket;
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this.inputManager = inputManager;
    this.extMan = extMan;
    this.mainUI = mainUI;
    this.gameStarted = false;
    // playerInfo stores information regarding the current player.
    this.playerInfo = undefined;
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
        this.mainUI.errorModal.displayError("Authorization failed.", "Please refresh to reconnect.");
        this.onDisconnect();
      });
      socket.on('gameStart', (msg) => {
        this.onStartup(msg);
      });
      socket.on('stateTransfer', (msg) => {
        this.gameState.acceptStateTransfer(msg);
        console.debug('State transfer done!');
      });
      socket.on('playerUpdate', (msg) => {
        this.gameState.onPlayerUpdate(PlayerSyncMessage.fromObject(msg));
      });
      socket.on('extBC', (msg) => {
        // Note: The method below is async but we ignore its promise.
        this.extMan.onExtensionBroadcast(msg);
      });
      socket.on('cellSet', (msg) => {
        this.gameState.onCellSet(msg.op, msg.mapName, msg.cellSet);
      });
      socket.on('callS2cAPI', (msg, callback) => {
        let p = this.extMan.onS2cAPICalled(msg);
        p.then((result) => {
          if (result.error) {
            console.warn(`Error on callS2cAPI('${msg.extName}', ` +
              `'${msg.methodName}', '${msg.args}'): ` +
              `${JSON.stringify(result)}`);
          }
          callback(result);
        });
      });
    });
    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        this.mainUI.errorModal.displayError(reason, "Please refresh to reconnect.");
      }
    });
  }

  /**
   * This is called when we're authenticated and ready to start the game.
   * @param {object} msg - The game start message from server.
   */
  async onStartup(msg) {
    if (this.gameStarted) {
      console.error('Duplicate game start event.');
      return;
    }
    this.playerInfo = Player.fromObject(msg.playerData);
    console.log('Game started.');

    this.gameStarted = true;
    this.gameState.registerOnPlayerUpdate((msg) => {
      if (msg.playerID === this.playerInfo.playerID) {
        this.playerInfo.updateFromMessage(msg);
        // Notify the extensions as well.
        this.extMan.notifySelfPlayerUpdate(msg);
      }
    });

    window.dispatchEvent(new CustomEvent(
        'gameStart', {
          detail: {gameClient: this},
        },
    ));
  }

  /**
   * This is called when user presses a direction key.
   * @param {string} direction - 'U', 'D', 'L', R'
   */
  async onDirection(direction) {
    console.debug(`On direction ${direction}`);
    const {x, y} = this.playerInfo.mapCoord;
    if (direction == 'U') {
      await this.moveTo(x, y+1, 'U');
    } else if (direction == 'D') {
      await this.moveTo(x, y-1, 'D');
    } else if (direction == 'L') {
      await this.moveTo(x-1, y, 'L');
    } else if (direction == 'R') {
      await this.moveTo(x+1, y, 'R');
    }
  }

  /**
   * Emit message to move to a location.
   * @param {Number} x
   * @param {Number} y
   * @param {string} facing
   */
  async moveTo(x, y, facing) {
    const msg = PlayerSyncMessage.fromObject({
      playerID: this.playerInfo.playerID,
      mapCoord: new MapCoord(this.playerInfo.mapCoord.mapName, x, y),
      facing: facing,
    });
    this.socket.emit('playerUpdate', msg);
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
