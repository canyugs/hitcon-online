// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * This class is the base class for class that is in charge of handling all RPC
 * calls internal to HITCON online.
 * This class is inherited by other classes actually implements the RPC.
 * For example: SingleProcessRPCDirectory or MultiProcessRPCDirectory.
 */
class Directory {
  /**
   * Create the RPC Directory.
   * @constructor
   */
  constructor() {
    // Do nothing, this is the base class.
  }

  /**
   * Register a service
   * @param {string} name - The name of the service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  registerService(name) {
    void name;
    assert.fail('Not implemented');
    return undefined;
  }

  /**
   * Add a gateway service service name.
   * This is called so that we know which service name belongs to gateway
   * service.
   * @param {string} name - Name of the gateway service.
   */
  addGatewayServiceName(name) {
  }
  
  /**
   * Return the list of gateway service service name.
   * @param {object} arr - An array of gateway service name.
   */
  getGatewayServices() {
    return [];
  }

  /**
   * Retrieve the redis client.
   * @return {redis} redis - A redis client.
   */
  getRedis() {
    return undefined;
  }
}

export default Directory;
