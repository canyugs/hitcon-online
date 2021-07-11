// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ExtConst from './ext-const.mjs';

const S2C_RPC_FUNC_PREFIX = ExtConst.S2C_RPC_FUNC_PREFIX();

class ClientExtensionHelper {
  /**
   * Create the ClientExtensionHelper object.
   * This is usually called by the ClientExtensionManager.
   * @param {Socket} socket - The socket.io socket from the game client.
   * @constructor
   */
  constructor(extName, extMan, socket) {
    this.extName = extName;
    this.extMan = extMan;
    this.socket = socket;
    this.clientAPIs = {};
    this.responseTable = {};
  }

  /**
   * Called by the client extension manager to set the extension object.
   * @param {Object} ext - The actual client extension object.
   */
  setExt(ext) {
    this.ext = ext;
    // Automatically registers all the s2c APIs.
    for (const propertyName of Object.getOwnPropertyNames(Object.getPrototypeOf(ext))) {
      if (typeof ext[propertyName] === 'function' && propertyName.substr(0, S2C_RPC_FUNC_PREFIX.length) == S2C_RPC_FUNC_PREFIX) {
        this.registerS2cAPI(propertyName.substr(S2C_RPC_FUNC_PREFIX.length), ext[propertyName]);
      }
    }
  }

  /**
   * This is called when the game starts.
   * @param {GameMap} gameMap - The GameMap object.
   * @param {GameState} gameState - The GameState object.
   * @param {GameClient} gameClient
   * @param {InputManager} inputManager
   * @param {MapRenderer} mapRenderer
   */
  async gameStart(gameMap, gameState, gameClient, inputManager, mapRenderer) {
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.gameClient = gameClient;
    this.inputManager = inputManager;
    this.mapRenderer = mapRenderer;
  }

  /**
   * Call an API provided by the same extension's standalone part
   * on the server side.
   * @param {string} extName - The name of the extension.
   * @param {string} methodName - The name of the API.
   * @param {Number} timeout - An optional timeout in ms.
   * @param {Array} args - Arguments to the call.
   * @return {object} result - The result from the call.
   */
  async callC2sAPI(extName, methodName, timeout, ...args) {
    // TODO: Emit the corresponding event through socket in game client.
    if (!timeout) timeout = 0;
    if (typeof extName != 'string' || extName == '') {
      extName = this.extName;
    }
    const resultPromise = new Promise((resolve, reject) => {
      // TODO: Fill in callArgs so gateway service knows how to handle it.
      const timeoutTimer = setTimeout(() => {
        resolve({error: 'timeout'});
      }, timeout);

      let callArgs = {
        extName: extName,
        methodName: methodName,
        args: args
      };
      // TODO: Handle timeout.
      this.socket.emit('callC2sAPI', callArgs, (result) => {
        // TODO: Resolve the promise and return the result.
        clearTimeout(timeoutTimer);
        resolve(result);
      });
    });
    return await resultPromise;
  }

  /**
   * This is called by client extension manager when there's an API of this
   * extension being called from the server side.
   * @param {string} methodName - Which method is called?
   * @param {object} args - The argument to the call.
   * @return {object} result - Result from the call.
   */
  async onS2cAPICalled(methodName, args) {
    // TODO: Forward to corresponding method in client.mjs.
    if (typeof methodName !== 'string' || !methodName in this.clientAPIs) {
      return {'error': 'Api name not found'};
    }
    const fn = this.clientAPIs[methodName];
    if (typeof fn != 'function') {
      return {'error': 'Api not function'};
    }
    return await fn.call(this.ext, ...args);
  }

  /**
   * Register an API for the standalone or gateway part of the extension.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (args)
   * Whereby args is an object. It returns another object that is the result.
   */
  registerS2cAPI(methodName, methodFunction) {
    if (typeof methodName !== 'string') {
      throw 'Api name is not a string';
    }
    if (typeof methodFunction !== 'function') {
      throw 'Method name is not a function';
    }
    if (!(methodName in this.clientAPIs)) {
      this.clientAPIs[methodName] = methodFunction;
    } else {
      throw `Duplicate registration of method ${methodNam}`;
    }
  }

  /**
   * Return the game map.
   */
  getMap() {
    return this.extMan.gameMap;
  }
};

export default ClientExtensionHelper;
