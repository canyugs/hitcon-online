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
   * @param {MapRenderer} mapRenderer
   * @param {InputManager} inputManager
   * @param {ClientExtensionManager} extMan
   * state.
   * @constructor
   */
  constructor(socket, gameState, mapRenderer, inputManager, extMan) {
    this.socket = socket;
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this.inputManager = inputManager;
    this.extMan = extMan;
    this.gameStarted = false;
    // playerInfo stores information regarding the current player.
    this.playerInfo = {};
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
      socket.on('stateTransfer', (msg) => {
        this.gameState.acceptStateTransfer(msg);
        console.log('State transfer done!');
      });
      socket.on('location', (msg) => {
        this.gameState.onLocation(msg);
      });
      socket.on('extBC', (msg) => {
        // Note: The method below is async but we ignore its promise.
        this.extMan.onExtensionBroadcast(msg);
      });
      socket.on('cset', (cset) => {
        if (cset.type == 'unset') {
          delete this.gameState.cellSet[cset.name];
          this.gameState.gameMap.unsetDynamicCellSet(cset.name);
        } else if (cset.type == 'set') {
          this.gameState.cellSet[cset.name] = cset.cellSet;
          this.gameState.gameMap.setDynamicCellSet(cset.cellSet);
        } else {
          throw `Unknown cellSet update object with type ${cset.type}`;
        }
      });
      socket.on('callS2cAPI', (msg, callback) => {
        let p = this.extMan.onS2cAPICalled(msg);
        p.then((result) => {
          callback(result);
        });
      });
    });
  }

  /**
   * This is called when we're authenticated and ready to start the game.
   * @param {object} msg - The game start message from server.
   */
  async onStartup(msg) {
    if (this.gameStarted) {
      console.assert('Duplicate game start event.');
      return;
    }
    let pi = this.playerInfo;
    pi.playerID = msg.playerData.playerID;
    pi.displayName = msg.playerData.displayName;
    pi.displayChar = msg.playerData.displayChar;
    let p = this.gameState.getPlayer(pi.playerID);
    [pi.x, pi.y, pi.facing] = [p.x, p.y, p.facing];
    console.log('Game starting');

    this.gameStarted = true;
    this.gameState.registerPlayerLocationChange((loc) => {
      if (loc.playerID == this.playerInfo.playerID) {
        [this.playerInfo.x, this.playerInfo.y, this.playerInfo.facing] =
            [loc.x, loc.y, loc.facing];
        // Notify the extensions as well.
        this.extMan.notifySelfLocationUpdate(loc);
      }
    });
    this.mapRenderer.initializeViewerPosition();
    this._initializeInputs();
  }

  /**
   * Initialize the inputs for the game.
   */
  _initializeInputs() {
    this.inputManager.onMove((direction) => {
      this.onDirection(direction);
    });
  }

  /**
   * This is called when user presses a direction key.
   * @param {string} direction - 'U', 'D', 'L', R'
   */
  async onDirection(direction) {
    console.log(`On direction ${direction}`);
    if (direction == 'U') {
      await this.moveTo(this.playerInfo.x, this.playerInfo.y-1, 'U');
    } else if (direction == 'D') {
      await this.moveTo(this.playerInfo.x, this.playerInfo.y+1, 'D');
    } else if (direction == 'L') {
      await this.moveTo(this.playerInfo.x-1, this.playerInfo.y, 'L');
    } else if (direction == 'R') {
      await this.moveTo(this.playerInfo.x+1, this.playerInfo.y, 'R');
    }
  }

  /**
   * Emit message to move to a location.
   * @param {Number} x
   * @param {Number} y
   * @param {string} facing
   */
  async moveTo(x, y, facing) {
    let loc = {};
    [loc.x, loc.y, loc.facing] = [x, y, facing];
    this.socket.emit('location', loc);
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
