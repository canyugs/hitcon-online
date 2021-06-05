// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import { io } from "socket.io-client";

class ClientExtensionHelper {
  /**
   * Create the ClientExtensionHelper object.
   * This is usually called by the ClientExtensionManager.
   * @constructor
   */

  constructor(extName) {
    this.extName = extName;
    this.socket = io();
    this.clientAPIs = {};
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
    if (methodName in this.clientAPIs) {
      if (!timeout) timeout = 0;
      const resultPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          this.socket.emit(methodName, args);
          this.socket.on('blablabla', (apiResult) => {
            const finalResult = clientAPIs[methodName].callback(apiResult);
            resolve(finalResult);
          })
        }, timeout);
      });
      return await resultPromise;
    }
  }

  /**
   * Register an API for the standalone or gateway part of the extension.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (args)
   * Whereby args is an object. It returns another object that is the result.
   */
  registerClientAPI(methodName, callback) {
    this.clientAPIs[methodName] = callback;
  }
};

export default ClientExtensionHelper;
