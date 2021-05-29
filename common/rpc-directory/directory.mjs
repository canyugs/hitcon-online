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
   * Part of the constructor that needs to be async.
   * This is created because constructor can't be async.
   * Note that this is called right after the constructor.
   */
  async asyncConstruct() {
    // Nothing here.
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
    this.redis.hgetallAsync = promisify(this.redis.hgetall);
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
  async addGatewayServiceName(name) {
    let ret = await getRedis().hsetAsync(['gatewayServers', name, name]);
    if (ret !== 1) {
      throw 'Failed to add gateway service name to redis: '+ret;
    }
  }
  
  /**
   * Return the list of gateway service service name.
   * @param {object} arr - An array of gateway service name.
   */
  async getGatewayServices() {
    let ret = await getRedis().hgetallAsync('gatewayServers');
    let result = [];
    for (const p in ret) {
      result.push(p);
    }
    return result;
  }

  /**
   * Return the redis key for the corresponding player.
   * @param {string} playerName - The player's ID.
   */
  _getPlayerKey(playerName) {
    return 'p-'+playerName;
  }

  /**
   * Register the gateway service handling the user/player.
   * This is called by gateway service when the player connects.
   * @param {string} playerName - The player's ID.
   * @param {string} serviceName - The service
   * @return {boolean} success - True if successful, and player may proceed.
   * False if someone else is already logged in as that user.
   */
  async registerPlayer(playerName, serviceName) {
    // NX: Only set if it doesn't exist.
    let ret = await getRedis().setAsync(
        [this._getPlayerKey(playerName), serviceName, 'NX']);
    if (ret === null) {
      // Player already connected with another connection.
      return false;
    }
    if (ret === 'OK') {
      // Set correctly.
      // TODO: Notify other services with pub/sub?
      return true;
    }
    // Shouldn't happen.
    console.assert('Invalid reply from redis in registerPlayer: '+ret);
    return false;
  }

  /**
   * Unregister the gateway service handling the user/player.
   * This is called by gateway service when the player disconnects.
   * @param {string} playerName - The player's ID.
   * @param {string} serviceName - The service
   */
  async unregisterPlayer(playerName, serviceName) {
    // Get the key to check that we're indeed the service holding the user.
    let ret = await getRedis().getAsync([this._getPlayerKey(playerName)]);
    if (ret !== serviceName) {
      throw (`Service ${serviceName} trying to unregister ${playerName} ` +
          `ownered by ${ret}`);
    }
    ret = await getRedis().delAsync([this._getPlayerKey(playerName)]);
    if (ret !== 1) {
      throw `${ret} keys deleted when trying to unregister ${playerName}`;
    }
    await this.storage.unloadData(this._getPlayerDataName(playerName));
  }

  /**
   * Return the data name for use in DataStore for the corresponding player.
   * @param {string} playerName - The player's ID.
   */
  _getPlayerDataName(playerName) {
    return `p-${playerName}`;
  }
  
  /**
   * Return the stored data for player.
   * @param {string} playerName - The player's ID.
   * @return {object} playerData - The player's data. It's format is in
   * ensurePlayerData().
   */
  async getPlayerData(playerName) {
    const dataName = this._getPlayerDataName(playerName);
    let data = await this.storage.loadData(dataName);
    data = ensurePlayerData(data);
    return data;
  }
  
  /**
   * Save the player's data.
   * @param {string} playerName - The player's ID.
   * @return {object} playerData - The player's data. It's format is in
   * ensurePlayerData().
   */
  async setPlayerData(playerName, playerData) {
    const dataName = this._getPlayerDataName(playerName);
    let data = await this.storage.saveData(dataName, playerData);
  }

  /**
   * Initialize the player data if it's not initialized.
   * @param {string} playerName - The player's ID.
   * @param {object} playerData - The player's data.
   * @return {object} playerData - The player's data that is initialized.
   */
  ensurePlayerData(playerName, playerData) {
    function setDefaultValue(obj, key, val) {
      if (!(key in obj)) {
        key[obj] = val;
      }
    }
    // {string} playerName - The player's ID. The primary key used in our
    // system.
    setDefaultValue(playerData, 'playerName', playerName);
    // {string} displayName - The name to show for the player on screen.
    setDefaultValue(playerData, 'displayName', playerName);

    // TODO: Set them to a default specified by assets.json.
    // {string} displayChar - The graphic for the character. This is used and
    // passed to GraphicAssets.
    setDefaultValue(playerData, 'displayChar', 'char1');

    // TODO: Set them to a spawn point specified by map.json.
    // {Number} x - Character's x coordinate.
    setDefaultValue(playerData, 'x', 5);
    // {Number} y - Characetr's y coordinate.
    setDefaultValue(playerData, 'y', 5);

    return playerData;
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
