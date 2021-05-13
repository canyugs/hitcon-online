// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import Directory from './directory'
import Handler from './handler'

/**
 * This class is handling all RPC calls in Single Process version.
 */
class SingleProcessRPCDirectory extends Directory {
  /**
   * Create the RPC Directory.
   * @constructor
   */
  constructor() {
    this.handlers = {};
  }

  /**
   * Register a service
   * @param {string} name - The name of the service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  registerService(name) {
    if(name in this.handlers){
        throw 'A service with the same name has been registered';
    }
    this.handlers[name] = new Handler(name);
    return this.handlers[name];
  }
}

export default SingleProcessRPCDirectory;
