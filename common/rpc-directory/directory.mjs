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
import MockRedis from './mock-redis.mjs'
import {MapCoord} from '../maplib/map.mjs';

const mockRedis = new MockRedis();

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
    // Redis connection for everything.
    this.redis = undefined;
    // Redis connection for subscribe. This is needed because redis requires
    // subscribe connection to be standalone.
    this.redisSub = undefined;
    if (config.get('redis.type') == 'real') {
      this._createRealRedis();
    } else if(config.get('redis.type') == 'mock') {
      this._createMockRedis();
    } else {
      throw 'invalid redis type ' + config.get('type');
    }
    // An object that maps channel ID to a list of callbacks for pub/sub.
    // callback is of the format: function (channel, message)
    this.channelSub = {};
    // Set to true if on('message') have been set.
    this.subscribed = false;
  }

  /**
   * Part of the constructor that needs to be async.
   * This is created because constructor can't be async.
   * Note that this is called right after the constructor.
   */
  async asyncConstruct() {
    // Nothing here, see derived classes.
  }

  /**
   * Create the real redis client and create the async functions.
   */
  _createRealRedis() {
    this.redis = redis.createClient(config.get('redis.option'));
    this.redis.getAsync = promisify(this.redis.get);
    this.redis.setAsync = promisify(this.redis.set);
    this.redis.delAsync = promisify(this.redis.del);
    this.redis.publishAsync = promisify(this.redis.publish);
    this.redis.hsetAsync = promisify(this.redis.hset);
    this.redis.hgetAsync = promisify(this.redis.hget);
    this.redis.hgetallAsync = promisify(this.redis.hgetall);
    this.redis.flushallAsync = promisify(this.redis.flushall);
    this.redis.scanAsync = promisify(this.redis.scan);

    this.redisSub = redis.createClient(config.get('redis.option'));
    this.redisSub.subscribeAsync = promisify(this.redis.subscribe);
  }

  /**
   * Create the real redis client and create the async functions.
   */
  _createMockRedis() {
    this.redis = mockRedis.createClient();
    this.redis.getAsync = promisify(this.redis.get);
    this.redis.setAsync = promisify(this.redis.set);
    this.redis.delAsync = promisify(this.redis.del);
    this.redis.subscribeAsync = promisify(this.redis.subscribe);
    this.redis.publishAsync = promisify(this.redis.publish);
    this.redis.hsetAsync = promisify(this.redis.hset);
    this.redis.hgetAsync = promisify(this.redis.hget);
    this.redis.hgetallAsync = promisify(this.redis.hgetall);
    this.redis.flushallAsync = promisify(this.redis.flushall);
    this.redis.scanAsync = promisify(this.redis.scan);

    this.redisSub = mockRedis.createClient();
    this.redisSub.subscribeAsync = promisify(this.redis.subscribe);
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
    let ret = await this.getRedis().hsetAsync(['gatewayServers', name, name]);
    if (!(ret === 1)) {
      throw `Failed to add gateway service name to redis: ${ret}`;
    }
  }

  /**
   * Add an extension service service name to redis.
   * This is called so that we know how to reach each extension service.
   */
  async addExtensionServiceName(extName, serviceName) {
    let ret = await this.getRedis().hsetAsync(['extServers', extName, serviceName]);
    if (!(ret === 1)) {
      throw `Failed to add extension service name to redis: ${ret}`;
    }
  }

  /**
   * Return the list of gateway service service name.
   * @param {object} arr - An array of gateway service name.
   */
  async getGatewayServices() {
    let ret = await this.getRedis().hgetallAsync('gatewayServers');
    let result = [];
    for (const p in ret) {
      result.push(p);
    }
    return result;
  }

  /**
   * Return the service name of the extension.
   * @param {string} extName - The name of the extension.
   * @return {string} serviceName - Its service name. null if failed.
   */
  async getExtensionServiceName(extName) {
    // TODO: Cache this because service name doesn't change throughout the
    // current instance of server. i.e. Only restart results in name change.
    let ret = await this.getRedis().hgetAsync(['extServers', extName]);
    // Will get null if failed.
    if (typeof ret != 'string' || ret === '') {
      return null;
    }
    return ret;
  }

  /**
   * Return the redis key for the corresponding player.
   * @param {string} playerID - The player's ID.
   */
  _getPlayerKey(playerID) {
    return 'p-'+playerID;
  }

  /**
   * Register the gateway service handling the user/player.
   * This is called by gateway service when the player connects.
   * @param {string} playerID - The player's ID.
   * @param {string} serviceName - The service
   * @return {boolean} success - True if successful, and player may proceed.
   * False if someone else is already logged in as that user.
   */
  async registerPlayer(playerID, serviceName) {
    // NX: Only set if it doesn't exist.
    let ret = await this.getRedis().setAsync(
        [this._getPlayerKey(playerID), serviceName, 'NX']);
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
   * @param {string} playerID - The player's ID.
   * @param {string} serviceName - The service
   */
  async unregisterPlayer(playerID, serviceName) {
    // Get the key to check that we're indeed the service holding the user.
    let ret = await this.getRedis().getAsync([this._getPlayerKey(playerID)]);
    if (ret !== serviceName) {
      throw (`Service ${serviceName} trying to unregister ${playerID} ` +
          `ownered by ${ret}`);
    }
    ret = await this.getRedis().delAsync([this._getPlayerKey(playerID)]);
    if (ret !== 1) {
      throw `${ret} keys deleted when trying to unregister ${playerID}`;
    }
    await this.storage.unloadData(this._getPlayerDataName(playerID));
  }

  /**
   * Return the service name of the gateway service on which the user is on.
   * @param {string} playerID - The player's ID.
   * @return {string} serviceName - The service name of the gateway service
   * on which the player is on. undefined if failed.
   */
  async getPlayerGatewayService(playerID) {
    let ret = await this.getRedis().getAsync([this._getPlayerKey(playerID)]);
    if (typeof ret === 'string') {
      return ret;
    }
    return undefined;
  }

  /**
   * Return the data name for use in DataStore for the corresponding player.
   * @param {string} playerID - The player's ID.
   */
  _getPlayerDataName(playerID) {
    return `p-${playerID}`;
  }

  /**
   * Return the stored data for player.
   * @param {string} playerID - The player's ID.
   * @return {object} playerData - The player's data. It's format is in
   * ensurePlayerData().
   */
  async getPlayerData(playerID) {
    const dataName = this._getPlayerDataName(playerID);
    let data = await this.storage.loadData(dataName);
    data = this.ensurePlayerData(playerID, data);
    return data;
  }

  /**
   * Save the player's data.
   * @param {string} playerID - The player's ID.
   * @return {object} playerData - The player's data. It's format is in
   * ensurePlayerData().
   */
  async setPlayerData(playerID, playerData) {
    const dataName = this._getPlayerDataName(playerID);
    let data = await this.storage.saveData(dataName, playerData);
  }

  /**
   * Initialize the player data if it's not initialized.
   * @param {string} playerID - The player's ID.
   * @param {object} playerData - The player's data.
   * @return {object} playerData - The player's data that is initialized.
   */
  ensurePlayerData(playerID, playerData) {
    function setDefaultValue(obj, key, val) {
      if (!(key in obj)) {
        obj[key] = val;
      }
    }
    // {string} playerID - The player's ID. The primary key used in our
    // system.
    setDefaultValue(playerData, 'playerID', playerID);
    // {string} displayName - The name to show for the player on screen.
    setDefaultValue(playerData, 'displayName', playerID);

    // TODO: Set them to a default specified by assets.json.
    // {string} displayChar - The graphic for the character. This is used and
    // passed to GraphicAssets.
    setDefaultValue(playerData, 'displayChar', 'char1');

    // If the playerData is loaded from storage, convert playerData.mapCoord
    // (which is an object) to MapCoord class.
    if ('mapCoord' in playerData) {
      playerData.mapCoord = MapCoord.fromObject(playerData.mapCoord);
    }

    // TODO: Set them to a spawn point specified by map.json.
<<<<<<< HEAD
    // {MapCoord} mapCoord - Character's map coordinate.
    setDefaultValue(playerData, 'mapCoord', new MapCoord('world1', 10, 10));
=======
    // {Number} x - Character's x coordinate.
    setDefaultValue(playerData, 'x', -1);
    // {Number} y - Characetr's y coordinate.
    setDefaultValue(playerData, 'y', -1);
>>>>>>> Set PlayerData Default Value -1

    return playerData;
  }

  /**
   * Subscribe to a redis pub/sub channel.
   * @param {string} channel - The channel to subscribe to.
   * @param {function} callback - The callback to call.
   */
  async subChannel(channel, callback) {
    if (!this.subscribed) {
      this.getRedis().on('message', (channel, message) => {
        this.onPubSubMessage(channel, message);
      });
      this.subscribed = true;
    }
    if (!(channel in this.channelSub)) {
      this.channelSub[channel] = [];
      await this.getRedis().subscribeAsync(channel);
    }
    this.channelSub.push(callback);
  }

  /**
   * Called when we've a pub/sub message.
   */
  async onPubSubMessage(channel, message) {
    if (channel in this.channelSub) {
      for (const f in this.channelSub) {
        f(channel, message);
      }
    }
  }

  /**
   * Retrieve the redis client.
   * @return {redis} redis - A redis client.
   */
  getRedis() {
    return this.redis;
  }

  /**
   * Retrieve the redis client for subscription.
   * @return {redis} redis - A redis client.
   */
  getRedisSub() {
    return this.redisSub;
  }
}

export default Directory;
