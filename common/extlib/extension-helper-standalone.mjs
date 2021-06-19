// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import ExtensionHelperBase from './extension-helper-base.mjs';

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
   */
  constructor(extMan, dir, broadcaster, name) {
    super(extMan, dir, undefined, broadcaster, name);
  }

  /**
   * The async part of the constructor.
   * @override
   */
  async asyncConstructor() {
    this.rpcHandler = await this.dir.registerService(`ext_${this.name}`);
    await super.asyncConstructor();
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
   * Register an API for other extensions to call.
   * This should only be called from the Standalone extension service.
   * In-gateway part of the extension should not export any APIs.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (args)
   * Whereby user is the Player object and args is an object.
   * It returns another object that is the result.
   */
  registerExtensionAPI(methodName, callback) {
    void [methodName, callback];
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
