// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import path from 'path';
import url from 'url';
import * as fsp from 'node:fs/promises';

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');

import assert from 'assert';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

import ExtensionHelperStandalone from './extension-helper-standalone.mjs';
import ExtensionHelperInGateway from './extension-helper-in-gateway.mjs';
import Player from './player.mjs';

/**
 * This class manages the extensions, allowing callers to start an instance of
 * the specified extension's server, or call an extension's API.
 */
class ExtensionManager {
  /**
   * Create the ExtensionManager.
   * @constructor
   * @param {Directory} directory - An RPC Directory instance.
   * @param {AllAreaBroadcaster} broadcaster - A broadcaster for broadcasting
   * message.
   * @param {GameMap} gameMap
   * @param {GameState} gameState
   */
  constructor(directory, broadcaster, gameMap, gameState) {
    this.dir = directory;
    this.broadcaster = broadcaster;
    this.gameMap = gameMap;
    this.gameState = gameState;
    // This maps the extension name to an object that have the following:
    // standaloneClass - The standalone class of the extension.
    // inGatewayClass - The inGateway class of the extension.
    // standalone - The standalone instance.
    // inGateway - The inGateway instance.
    // standaloneHelper - The helper class for standalone instance.
    // Note that it's not always that the above are populated.
    this.ext = {};
  }

  /**
   * Initialize the extension manager.
   */
  async initialize() {
  }

  /**
   * This is called by gateway service to set the rpc handler used to call
   * standalone services.
   */
  setRpcHandlerFromGateway(rpcHandler) {
    this.rpcHandler = rpcHandler;
  }

  /**
   * Ensure that the class for the given extension is loaded.
   * If there's any failure, this class will throw an exception.
   * @param {string} name - The name of the extension.
   */
  async ensureClass(name) {
    if (!(name in this.ext)) {
      this.ext[name] = {};
    }
    if (!('standaloneClass' in this.ext[name]) || typeof this.ext[name].standaloneClass == 'undefined') {
      // Standalone class not loaded.
      const imported = await import(`../../extensions/${name}/standalone.mjs`);
      if (typeof imported.default != 'function') {
        throw `Default export of extensions/${name}/standalone.mjs is not a function.`;
      } else {
        this.ext[name].standaloneClass = imported.default;
      }
    }
    if (!('inGatewayClass' in this.ext[name]) || typeof this.ext[name].inGatewayClass == 'undefined') {
      // InGateway class not loaded.
      const imported = await import(`../../extensions/${name}/in-gateway.mjs`);
      if (typeof imported.default != 'function') {
        throw `Default export of extensions/${name}/in-gateway.mjs is not a function.`;
      } else {
        this.ext[name].inGatewayClass = imported.default;
      }
    }
  }

  /**
   * Create the extension server for the specified extension, but does
   * NOT start it.
   * This function is usually called in the construction phase of the
   * parent process. After all services have been created and registered,
   * then we call startExtensionService() below.
   * Note that the extension server is always created in the current
   * calling process.
   * If there's any failure, an exception will be thrown.
   * @param {String} name - The name of the extension.
   */
  async createExtensionService(name) {
    // Load the classes if they are not loaded.
    await this.ensureClass(name);

    // TODO: Check if already created?
    this.ext[name].standaloneHelper = new ExtensionHelperStandalone(
        this, this.dir, this.broadcaster, name, this.gameMap, this.gameState);
    this.ext[name].standalone = new this.ext[name].standaloneClass(
        this.ext[name].standaloneHelper);
    await this.ext[name].standaloneHelper.asyncConstructor(this.ext[name].standalone);
  }

  /**
   * Start the extension server for the specified extension.
   * createExtensionService() should have been called before calling this.
   * This expects all services to already be registered.
   * Note that the extension server is always started in the current
   * calling process.
   * This and createExtensionService() should be called in the same process.
   * If there's any failure, an exception will be thrown.
   * @param {String} name - The name of the extension.
   */
  async startExtensionService(name) {
    if (!(name in this.ext) || !('standalone' in this.ext[name]) || typeof this.ext[name].standalone != 'object') {
      throw `Extension ${name} not created`;
    }
    await this.ext[name].standalone.initialize();
  }

  /**
   * Create the InGateway portion of an extension.
   * This is usually created in the initialization phase of gateway service.
   * If there's any failure, an exception will be thrown.
   * @param {String} name - The name of the extension.
   * @param {RPCHandler} rpcHandler - The RPC Handler for the gateway service.
   * @param {GatewayService) gateway - The gateway service object.
   */
  async createExtensionInGateway(name, rpcHandler, gateway) {
    // Load the classes if they are not loaded.
    await this.ensureClass(name);

    // TODO: Check if already created?
    this.ext[name].inGatewayHelper = new ExtensionHelperInGateway(
        this, this.dir, rpcHandler, gateway, this.broadcaster, name, this.gameMap, this.gameState);
    await this.ext[name].inGatewayHelper.asyncConstructor();
    this.ext[name].inGateway = new this.ext[name].inGatewayClass(
        this.ext[name].inGatewayHelper);
  }

  /**
   * Start the in gateway part of extension service for the specified
   * extension.
   * This is usually called in the initialization phase of gateway service.
   * If there's any failure, an exception will be thrown.
   * @param {String} name - The name of the extension.
   */
  async startExtensionInGateway(name) {
    if (!(name in this.ext) || !('inGateway' in this.ext[name]) || typeof this.ext[name].inGateway != 'object') {
      throw `InGateway part of Extension ${name} not created`;
    }
    if (typeof this.ext[name].inGateway.initialize === 'function') {
      await this.ext[name].inGateway.initialize();
    } else {
      console.warn(`Extension ${name}'s InGateway part doesn't have initialize().`);
    }
  }

  /**
   * Create all extensions in gateway.
   * @param {RPCHandler} rpcHandler - The RPC Handler for the gateway service.
   * @param {GatewayService) gateway - The gateway service object.
   */
  async createAllInGateway(rpcHandler, gateway) {
    for (const extName of this.listExtensions()) {
      await this.createExtensionInGateway(extName, rpcHandler, gateway, this.gameMap, this.gameState);
    }
  }

  /**
   * Start all extensions in gateway.
   */
  async startAllInGateway() {
    for (const extName of this.listExtensions()) {
      await this.startExtensionInGateway(extName);
    }
  }

  /**
   * Return an array of String that is the list of extensions available.
   * @return {object} names - An array of String, each is an available
   * extension.
   */
  listExtensions() {
    // TODO: Check if these extensions really exists.
    return config.get('ext.enabled');
  }

  /**
   * Return the full path to files in an extension.
   */
  _getExtFilePath(extName, p) {
    return path.resolve(__dirname + `/../../extensions/${extName}/${p}`);
  }

  /**
   * Helper to check if a file exists under an extension.
   */
  async _extFileExists(extName, p) {
    const fpath = this._getExtFilePath(extName, p);
    try {
      const st = await fsp.stat(fpath);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Collect and return the partials from all the extensions listed.
   * @param {Object} names - An array of extension name.
   * @param {String} clientType - 'desktop' or 'mobile'.
   * @return {Object} partials - An object, each element is the array of paths
   * for each location.
   */
  async collectPartials(names, clientType) {
    let result = {};
    for (const name of names) {
      // Load the classes if they are not loaded.
      await this.ensureClass(name);
      let p = {inDiv: 'in-div.ejs'};
      if (typeof this.ext[name].standaloneClass.getPartials === 'undefined') {
        // Not defined, use the default.
        if (!await this._extFileExists(name, p.inDiv)) {
          // in-div.ejs doesn't exist, no generic variant, try specific variant.
          p.inDiv = `in-div-${clientType}.ejs`;
          console.assert(await this._extFileExists(name, p.inDiv), `${p.inDiv} doesn't exist, neither does the generic variant for ${name} extension.`);
        }
      } else {
        try {
          p = this.ext[name].standaloneClass.getPartials(clientType);
        } catch (e) {
          console.error(`Unable to get partials for ${name}`, e.stack);
          // Use the default again.
        }
      }
      for (const loc in p) {
        if (!(loc in result)) {
          result[loc] = [];
        }
        result[loc].push(this._getExtFilePath(name, p[loc]));
      }
    }
    return result;
  }

  /**
   * Return a player object for use in the extension.
   * @param {String} playerID
   * @return {Player} player - The player object.
   */
  getPlayerObj(playerID) {
    return new Player(playerID);
  }

  /**
   * This is called by gateway service when any C2s APIs are called.
   * It'll either call the corresponding APIs in standalone or in-gateway,
   * or respond to the client with a fail message.
   * This should ONLY be called by gateway service.
   * @param {Object} msg - The message passed from the client.
   * @param {string} playerID - The name of the player.
   * @return {Object} result - The result of the call.
   */
  async onC2sCalled(msg, playerID) {
    const {extName, methodName, args} = msg;
    if (!(typeof extName === 'string')) {
      return {'error': 'extName not string'};
    }
    if (!(typeof methodName === 'string')) {
      return {'error': 'methodName not string'};
    }
    if (!(typeof args === 'object') || !Array.isArray(args)) {
      return {'error': 'args not array'};
    }
    // TODO: Try C2s in InGateway.
    return await this.callC2sInStandalone(extName, methodName, args, playerID);
  }

  /**
   * This is called by gateway service when E2s APIs are called.
   * It'll call the standalone E2s APIs directly.
   */
  async onE2sCalled(extName, apiName, args) {
    if (typeof extName !== 'string') {
      return {'error': 'extName not string'};
    }
    if (typeof apiName !== 'string') {
      return {'error': 'apiName not string'};
    }
    if (typeof args !== 'object' || !Array.isArray(args)) {
      return {'error': 'args not array'};
    }
    const extService = await this.dir.getExtensionServiceName(extName);
    if (typeof extService !== 'string') {
      console.error(`Service '${extName}' unavailable in onE2sCalled, got '${extService}'`);
      return {'error': 'Service unavailable'};
    }
    const result = await this.rpcHandler.callRPC(extService, 'callE2s', apiName, args);
    return result;
  }

  /**
   * Call the C2s RPC API in standalone service through RPC Directory.
   * This should ONLY be called from gateway service process.
   */
  async callC2sInStandalone(extName, methodName, args, playerID) {
    const extService = await this.dir.getExtensionServiceName(extName);
    if (typeof extService != 'string') {
      console.error(`Service '${extName}' unavailable in tryC2sInStandalone, got '${extService}'`);
      return {'error': 'Service unavailable'};
    }
    const result = await this.rpcHandler.callRPC(extService, 'callC2s', playerID, methodName, args);
    return result;
  }
}

export default ExtensionManager;
