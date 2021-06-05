// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ClientExtensionHelper from './client-extension-helper.mjs';

/**
 * This class manages the extensions on the client side.
 * It is in charge of loading them and providing them with a helper
 * class and other APIs to access browser side resources.
 */
class ClientExtensionManager {
  /**
   * Create the ClientExtensionManager.
   * @param {Socket} socket - The connection to backend.
   * @param {object} extNameList - An array of string, representing the list of
   * active extensions.
   * @constructor
   */
  constructor(socket, extNameList) {
    this.socket = socket;
    this.extNameList = extNameList;
    this.extModules = {};
    this.extObjects = {};
    this.extHelpers = {};
  }

  /**
   * Initialize the ClientExtensionManager.
   * @param {GameMap} gameMap - The GameMap object.
   * @param {GameState} gameState - The GameState object.
   * @param {GameClient} gameClient - The GameClient object.
   */
  async initialize(gameMap, gameState, gameClient) {
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.gameClient = gameClient;
  }

  /**
   * Result the list of extensions that's active/available.
   * @return {object} extensions - An array of string of extensions.
   */
  async listExtensions() {
    return this.extNameList;
  }

  /**
   * Load the browser side of an extension.
   * This is usually called when the page loads by loadAllExtensionClient().
   * @param {String} extName - The name of the extension.
   */
  async loadExtensionClient(extName) {
    // ignore invalid extensions
    if (this.extNameList.includes(extName)) {
      const modulePath = `../../extensions/${extName}`;
      const extModule = await import(modulePath);
      // TODO: check the type of extModule.default is a function.
      this.extModules[extName] = extModule;

      const extHelper = new ClientExtensionHelper(extName);
      /* register APIs to extension helper. */
      this.extHelpers[extName] = extHelper;

      this.extObjects[extName] = new this.extModules[extName].default();
    }
  }

  /**
   * Start the browser side of an extension.
   * This should be called after loadExtensionClient().
   * Usually this is called after game start event in GameClient.
   * @param {String} extName - The name of the extension.
   */
  async startExtensionClient(extName) {
    // TODO: Call gameStart() on each of the extensions.
    if (extName in this.extObjects) {
      await this.extHelpers[extName].gameStart(this.gameMap, this.gameState, this.gameClient);
      this.extObjects[extName].gameStart();
    } else {
      throw `Extension ${extName} not loaded`;
    }
  }

  /**
   * This is called when the server side calls a client extension's API.
   */
  async onClientAPICalled(msg) {
    const extName = msg.extName;
    const methodName = msg.methodName;
    const args = msg.args;
    // TODO: Pass it to the extension.
  }

  /**
   * This is called when server broadcasts something.
   * @param {object} msg - The message from the server.
   */
  async onExtensionBroadcast(msg) {
    // TODO: Pass message to extensions.
  }
};

export default ClientExtensionManager;
