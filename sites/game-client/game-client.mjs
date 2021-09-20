// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {Player, PlayerSyncMessage} from '/static/common/gamelib/player.mjs';

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
   * @param {MapRenderer} mapRenderer
   * @param {InputManager} inputManager
   * @param {ClientExtensionManager} extMan
   * @constructor
   */
  constructor(socket, gameMap, gameState, mapRenderer, inputManager, movementManager, extMan, mainUI) {
    this.socket = socket;
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this.inputManager = inputManager;
    this.movementManager = movementManager;
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
          if (typeof result !== 'object') {
            console.warn(`Result of callS2cAPI('${msg.extName}', ` +
              `'${msg.methodName}', '${msg.args}') is not an object: ` +
              `${JSON.stringify(result)}`);
          } else if (result.error) {
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
    socket.on("kicked", (reason) => {
      game.errorModal.displayError(reason, "Please refresh to reconnect.");
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

    this.gameStarted = true;
    this.gameState.registerOnPlayerUpdate((msg) => {
      if (msg.playerID === this.playerInfo.playerID) {
        this.playerInfo.updateFromMessage(msg);
        // Notify the extensions as well.
        this.extMan.notifySelfPlayerUpdate(msg);
      }
    });

    window.dispatchEvent(new CustomEvent(
        'dataReady', {
          detail: {gameClient: this},
        },
    ));

    // Start the browser side of all extensions.
    this.extMan.startAllExtensionClient();
  }
}

export default GameClient;
