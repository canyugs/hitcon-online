// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import Directory from './directory.mjs';
import Handler from './handler.mjs';

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
   * Call an RPC method.
   * Should be called via Handler, do not called this method directly.
   * @param {String} callerServiceName - The name of the caller service.
   * @param {String} serviceName - The name of the service.
   * @param {String} methodName - The name of the method.
   * @param {Object} args - The arguments.
   * @return {Object} result - The result of the call.
   */
  async callRPC(callerServiceName, serviceName, methodName, ...args) {
    void [callerServiceName, serviceName, methodName, args];
    if (!(serviceName in this.handlers)) {
      throw `Service ${serviceName} not found.`;
    }
    if (!(methodName in this.handlers[serviceName].methods)) {
      throw `Method ${methodName} not found.`;
    }

    return await this.handlers[serviceName].methods[methodName](callerServiceName, ...args);
  }

  /**
   * Register a service
   * @param {string} name - The name of the service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  async registerService(name) {
    if (name in this.handlers) {
      throw 'A service with the same name has been registered';
    }
    this.handlers[name] = new Handler(name, this);
    return this.handlers[name];
  }
}

export default SingleProcessRPCDirectory;
