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
  constructor(serviceName) {
    void serviceName;
    assert.fail('Not implemented');
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
    void [methodName, callback];
    assert.fail('Not implemented');
  }

  /**
   * Call an RPC method.
   * @param {String} serviceName - The name of the service.
   * @param {String} methodName - The name of the method.
   * @param {Object} args - The arguments.
   * @return {Object} result - The result of the call.
   */
  callRPC(serviceName, methodName, args) {
    void [serviceName, methodName, args];
    assert.fail('Not implemented');
    return undefined;
  }
}

export default Handler;
