// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import ExtensionHelperBase from './extension-helper-base.mjs';
import ExtConst from './ext-const.mjs';

/**
 * One ExtensionHelper class is created for each instance of Standalone object
 * for each extension. This ExtensionHelper object provides the APIs for
 * extensions to do what they want to do.
 */
class ExtensionHelperStandalone extends ExtensionHelperBase {
  /**
   * Create the ExtensionHelper object.
   * This is usually called by the ExtensionManager.
   * @constructor
   * @param {ExtensionManager} extMan - The extension manager.
   * @param {Directory} dir - An RPC Directory instance.
   * @param {AllAreaBroadcaster} broadcaster - A broadcaster for broadcasting
   * message.
   * @param {string} name - The name of the extension.
   * @param {GameMap} gameMap
   * @param {GameState} gameState
   */
  constructor(extMan, dir, broadcaster, name, gameMap, gameState) {
    super(extMan, dir, undefined, broadcaster, name, gameMap, gameState);
  }

  /**
   * The async part of the constructor.
   * @param {Extension} ext - The actual extension object.
   * @override
   */
  async asyncConstructor(ext) {
    this.ext = ext;
    this.rpcHandler = await this.dir.registerService(`ext_${this.name}`);
    await this.rpcHandler.registerAsExtension(this.name);
    this.rpcHandler.registerRPC('callS2s', this.onCallS2s.bind(this));
    this.rpcHandler.registerRPC('callC2s', this.onCallC2s.bind(this));
    await super.asyncConstructor(ext);
  }

  /**
   * This is called when another extension wants to call s2s rpc apis.
   */
  async onCallS2s(serviceName, srcExtName, methodName, args) {
    if (typeof methodName != 'string') {
      return {'error': 'methodName not string'};
    }
    if (!Array.isArray(args)) {
      return {'error': 'args is not array'};
    }
    const actualMethodName = ExtConst.S2S_RPC_FUNC_PREFIX() + methodName;
    if (typeof this.ext[actualMethodName] != 'function') {
      return {'error': 'method not found'};
    }
    try {
      return this.ext[actualMethodName](srcExtName, ...args);
    } catch (e) {
      console.error(e);
      console.error(`Error calling ${methodName} in ${this.name}`);
      return {'error': 'exception'};
    }
  }

  /**
   * This is called when gateway service wants to call a C2s RPC API for a
   * client.
   */
  async onCallC2s(serviceName, playerID, methodName, args) {
    const actualMethodName = ExtConst.C2S_RPC_FUNC_PREFIX() + methodName;
    if (typeof this.ext[actualMethodName] != 'function') {
      return {'error': `Extension ${this.name} doesn't have ${methodName}`};
    }
    const player = this.extMan.getPlayerObj(playerID);
    try {
      return await this.ext[actualMethodName](player, ...args);
    } catch (e) {
      console.error(`Exception ${e} calling standalone[${actualMethodName}]`);
      // Full exception detailed NOT provided for security reason.
      return {'error': 'exception'};
    }
  }

  /**
   * Register an interaction. See the definition in base class.
   * @override
   */
  registerInteraction(x, y, callback) {
    void [x, y, callback];
    assert.fail('Not implemented');
  }

  /**
   * Store a small amount of configuration/state data for the extension.
   * This method is atomic.
   * This is usually used when an extension wants to store something but
   * a full-blown database is too complicated.
   * This method is per extension. That is, different extension will have
   * their data stored separately.
   * Note that this method returns immediately. It'll start/trigger the file
   * write operation in the background.
   * @param {object} data - The data to store.
   */
  storeData(data) {
    void data;
    assert.fail('Not implemented');
  }

  /**
   * Load the data stored with storeData().
   * If this extension have not called storeData() before, then return an
   * empty object.
   * @return {object} data - The stored data.
   */
  loadData() {
    assert.fail('Not implemented');
    return {};
  }
}

export default ExtensionHelperStandalone;
