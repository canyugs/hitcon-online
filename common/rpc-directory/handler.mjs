// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * This class is used by a service to:
 * 1. Register itself and register APIs that's callable by other services.
 * 2. Call other services.
 */
class Handler {
  /**
   * Construct an RPC Handler.
   * This is usually only used by the Directory class.
   * @constructor
   * @param {String} serviceName - The name of the service.
   */
  constructor(serviceName, RPCDirectory) {
    this.serviceName = serviceName;
    this.RPCDirectory = RPCDirectory;
    this.methods = {};
    this.methods.serviceName = {};
  }

  /**
   * Register an RPC method with the directory.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback for this RPC method.
   * It's signature is:
   * async function(service, args) and it returns the result object.
   * service is the caller, args is the call arguments.
   * Caller should bind the callback to this before calling registerRPC.
   */
  registerRPC(methodName, callback) {
    if (methodName in this.methods) {
      throw 'A method with the same name has been registered';
    }
    this.methods[methodName] = callback;
  }

  /**
   * Call an RPC method.
   * @param {String} serviceName - The name of the service.
   * @param {String} methodName - The name of the method.
   * @param {Object} args - The arguments.
   * @return {Object} result - The result of the call.
   */
  async callRPC(serviceName, methodName, ...args) {
    void [serviceName, methodName, args];

    try {
      return await this.RPCDirectory.callRPC(this.serviceName, serviceName, methodName, ...args);
    } catch (e) {
      console.error(`Error calling rpc function '${methodName}' of '${serviceName}': `, e, e.stack);
      return {'error': 'exception'};
    }
  }

  /**
   * Return the data storage class for storing data.
   * @return {DataStore} storage - The data storage.
   */
  dataStore() {
    return this.storage;
  }

  /**
   * This is called to let the handler know that this service is a gateway
   * service.
   * Should only be called by gateway service.
   */
  async registerAsGateway() {
    await this.RPCDirectory.addGatewayServiceName(this.serviceName);
  }

  /**
   * This is called to let the handler know that this service is a standalone
   * extension service.
   * Should only be called by extension helper.
   * @param {string} extName - The name of the extension.
   */
  async registerAsExtension(extName) {
    await this.RPCDirectory.addExtensionServiceName(extName, this.serviceName);
  }
  /**
   * Register a player to this service.
   * Should only be called by gateway service.
   * @param {string} playerID - The player's ID.
   * @return {boolean} success - True if successful, and player may proceed.
   * False if someone else is already logged in as that user.
   */
  async registerPlayer(playerID) {
    return await this.RPCDirectory.registerPlayer(
        playerID, this.serviceName);
  }

  /**
   * Unregister a player.
   * Should only be called by gateway service, usually when a client
   * disconnects.
   * @param {string} playerID - The player's ID.
   */
  async unregisterPlayer(playerID) {
    return await this.RPCDirectory.unregisterPlayer(
        playerID, this.serviceName);
  }
}

export default Handler;
