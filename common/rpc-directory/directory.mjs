// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');
const redis = require('redis');

import assert from 'assert';
import { promisify } from 'util';

import DataStore from './data-store.mjs'

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
    this.storage = new DataStore();
    this.redis = undefined;
    if (config.get('redis.type') == 'real') {
      this._createRealRedis();
    } else {
      throw 'invalid redis type ' + config.get('type');
    }
  }

  /**
   * Create the real redis client and create the async functions.
   */
  _createRealRedis() {
    this.redis = redis.createClient(config.get('redis.option'));
    this.redis.getAsync = promisify(this.redis.get);
    this.redis.setAsync = promisify(this.redis.set);
    this.redis.subscribeAsync = promisify(this.redis.subscribe);
    this.redis.publishAsync = promisify(this.redis.publish);
    this.redis.hsetAsync = promisify(this.redis.hset);
    this.redis.hgetAsync = promisify(this.redis.hget);
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
    void name;
    assert.fail('Not implemented');
    return undefined;
  }
  
  /**
   * Return the list of gateway service service name.
   * @param {object} arr - An array of gateway service name.
   */
  getGatewayServices() {
    assert.fail('Not implemented');
    return [];
  }

  /**
   * Retrieve the redis client.
   * @return {redis} redis - A redis client.
   */
  getRedis() {
    return this.redis;
  }
}

export default Directory;
