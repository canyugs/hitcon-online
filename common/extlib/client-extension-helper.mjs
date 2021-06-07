// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class ClientExtensionHelper {
  /**
   * Create the ClientExtensionHelper object.
   * This is usually called by the ClientExtensionManager.
   * @param {Socket} socket - The socket.io socket from the game client.
   * @constructor
   */
  constructor(extName, socket) {
    this.extName = extName;
    this.socket = socket;
    this.clientAPIs = {};
    this.responseTable = {};
  }

  /**
   * This is called when the game starts.
   * @param {GameMap} gameMap - The GameMap object.
   * @param {GameState} gameState - The GameState object.
   * @param {GameClient} gameClient - The GameClient object.
   */
  async gameStart(gameMap, gameState, gameClient) {
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.gameClient = gameClient;
  }

  /**
   * Call an API provided by the same extension's standalone part
   * on the server side.
   * @param {string} methodName - The name of the API.
   * @param {object} args - An object representing the argument.
   * @param {Number} timeout - An optional timeout in ms.
   * @return {object} result - The result from the call.
   */
  async callStandaloneAPI(methodName, args, timeout) {
    // TODO: Emit the corresponding event through socket in game client.
    if (!timeout) timeout = 0;
    const resultPromise = new Promise((resolve, reject) => {
      // TODO: Fill in callArgs so gateway service knows how to handle it.
      const timeoutTimer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      let callArgs = {
        extName: this.extName,
        methodName: methodName,
        args: args
      };
      // TODO: Handle timeout.
      this.socket.emit('callStandaloneAPI', callArgs, (result) => {
        console.log('here');
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
  async onClientAPICalled(methodName, args) {
    // TODO: Forward to corresponding method in client.mjs.
  }

  /**
   * Register an API for the standalone or gateway part of the extension.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (args)
   * Whereby args is an object. It returns another object that is the result.
   */
  registerClientAPI(methodName, methodFunctionName) {
    if (typeof methodName !== 'string' || typeof methodFunctionName !== 'string') {
      throw 'Api name or api function name is not a string';
    }
    if (!methodName in this.clientAPIs) {
      this.clientAPIs[methodName] = methodFunctionName;
    }
  }
};

export default ClientExtensionHelper;
