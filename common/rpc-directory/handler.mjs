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
    this.methods = {}
    this.methods.serviceName = {};
  }

  /**
   * Register an RPC method with the directory.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback for this RPC method.
   * It's signature is:
   * async function(service, args) and it returns the result object.
   * service is the caller, args is the call arguments.
   */
  registerRPC(methodName, callback) {
    if(methodName in this.methods){
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
  async callRPC(serviceName, methodName, args) {
    void [serviceName, methodName, args];
    if(!(serviceName in this.RPCDirectory.handlers)){
      throw 'serviceName not found.';
    }
    if(!(serviceName in this.RPCDirectory.handlers[serviceName].methods)){
      throw 'Method not found.';
    }

    return await this.RPCDirectory.handlers[serviceName].methods[methodName].apply(args); // now it only takes list, WIP...
  }
}

export default Handler;
