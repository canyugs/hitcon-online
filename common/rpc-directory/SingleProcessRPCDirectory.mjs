// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import Directory from './directory.mjs'
import Handler from './handler.mjs'

/**
 * This class is handling all RPC calls in Single Process version.
 */
class SingleProcessRPCDirectory extends Directory {
  /**
   * Create the RPC Directory.
   * @constructor
   */
  constructor() {
    super();
    this.handlers = {};
  }

  /**
   * Part of the constructor that needs to be async.
   * This is created because constructor can't be async.
   * Note that this is called right after the constructor.
   */
  async asyncConstruct() {
    // In single process mode, we flush the redis on startup.
    this.getRedis().flushallAsync();
  }

  /**
   * Register a service
   * @param {string} name - The name of the service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  async registerService(name) {
    if(name in this.handlers){
        throw 'A service with the same name has been registered';
    }
    this.handlers[name] = new Handler(name, this);
    return this.handlers[name];
  }
}

export default SingleProcessRPCDirectory;
