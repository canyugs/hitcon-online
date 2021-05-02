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
    assert.fail('Not implemented');
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
}

export default Directory;
