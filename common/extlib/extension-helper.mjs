// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * One ExtensionHelper class is created for each instance of Standalone or
 * InGateway object for each extension. This ExtensionHelper object provides
 * the APIs for extensions to do what they want to do.
 */
class ExtensionHelper {
  /**
   * Create the ExtensionHelper object.
   * This is usually called by the ExtensionManager.
   * @constructor
   * @param {Directory} directory - An RPC Directory instance.
   */
  ExtensionHelper(directory) {
    void directory;
    assert.fail('Not implemented');
  }

  /**
   * Register an interaction. That is, if the user clicks on the map location
   * (x, y), then callback will be called.
   * @param {Number} x - The map x coordinate.
   * @param {Number} y - The map y coordinate.
   * @param {function} callback - The callback when user interact with the
   * specified tile in the map. Its prototype is:
   * async function (user)
   * Where user is an User object, who clicked/interacted with the map tile.
   */
  registerInteraction(x, y, callback) {
    void [x, y, callback];
    assert.fail('Not implemented');
  }

  /**
   * Return the list of all user IDs.
   * @return {object} An array of String, the user IDs.
   */
  listUserID() {
    assert.fail('Not implemented');
    return [];
  }

  /**
   * Return the User object for the corresponding user ID.
   * @param {String} uid - The user ID.
   * @return {User} user - The User object for interacting with the user.
   */
  getUser(uid) {
    void uid;
    assert.fail('Not implemented');
    return undefined;
  }

  /**
   * Register an API for users to call.
   * This should only be called from the Standalone extension service.
   * In-gateway part of the extension should not export any APIs.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (user, args)
   * Whereby user is the User object and args is an object.
   * It returns another object that is the result.
   */
  registerUserAPI(methodName, callback) {
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

export default ExtensionHelper;
