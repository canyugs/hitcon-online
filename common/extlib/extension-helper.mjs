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
   * @param {ExtensionManager} extMan - The extension manager.
   * @param {Directory} dir - An RPC Directory instance.
   * @param {AllAreaBroadcaster} broadcaster - A broadcaster for broadcasting
   * message.
   * @param {string} name - The name of the extension.
   */
  constructor(extMan, dir, broadcaster, name) {
    this.extMan = extMan;
    this.dir = dir;
    this.name = name;
    this.broadcaster = broadcaster;
  }

  /**
   * The async part of the constructor.
   */
  async asyncConstructor() {
    this.rpcHandler = await this.dir.registerService(`ext_${this.name}`);
  }

  /**
   * Register an interaction. That is, if the player clicks on the map location
   * (x, y), then callback will be called.
   * @param {Number} x - The map x coordinate.
   * @param {Number} y - The map y coordinate.
   * @param {function} callback - The callback when player interact with the
   * specified tile in the map. Its prototype is:
   * async function (player)
   * Where player is an Player object, who clicked/interacted with the map tile.
   */
  registerInteraction(x, y, callback) {
    void [x, y, callback];
    assert.fail('Not implemented');
  }

  /**
   * Return the list of all player IDs.
   * @return {object} An array of String, the player IDs.
   */
  listPlayerID() {
    assert.fail('Not implemented');
    return [];
  }

  /**
   * Return the Player object for the corresponding user ID.
   * @param {String} playerID - The player's ID.
   * @return {Player} player - The Player object for interacting with the user.
   */
  getPlayer(playerID) {
    void playerID;
    assert.fail('Not implemented');
    return undefined;
  }

  /**
   * Register an API for users to call. This can be called by code from the
   * browser side.
   * This should only be called from the Standalone extension service.
   * In-gateway part of the extension should not export any APIs.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (player, args)
   * Whereby player is the Player object and args is an object.
   * It returns another object that is the result.
   */
  registerPlayerAPI(methodName, callback) {
    void [methodName, callback];
    assert.fail('Not implemented');
  }

  /**
   * Call an API on the browser side.
   * @param {String} playerID - The ID of the player to call.
   * @param {String} extensionName - Name of the extension.
   * @param {String} methodName - Name of the method.
   * @param {object} args - The arguments.
   * @param {Number} timeout - An optional timeout in ms.
   * @return {object} result - The result from the call.
   */
  callPlayerAPI(playerID, extensionName, methodName, args, timeout) {
    void [playerID, extensionName, methodName, args, timeout];
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
   * Call the API of another extension.
   * @param {String} extensionName - The name of the extension.
   * @param {String} methodName - The name of the method.
   * @param {object} args - The arguments to the API.
   * @return {object} result - The result from the call.
   */
  callExtensionAPI(extensionName, methodName, args) {
    void [extensionName, methodName, args];
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

  /**
   * Broadcast a message to all clients.
   * @param {object} msg - The message.
   */
  async broadcastToAllUser(msg) {
    msg.extName = this.extName;
    this.broadcaster.broadcastExtensionMessage(msg);
  }
}

export default ExtensionHelper;
