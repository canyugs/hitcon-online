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
   * @param {GameClient} gameClient
   * @param {InputManager} inputManager
   * @param {MapRenderer} mapRenderer
   * @param {MainUI} mainUI
   */
  async initialize(gameMap, gameState, gameClient, inputManager, mapRenderer, mainUI) {
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.gameClient = gameClient;
    this.inputManager = inputManager;
    this.mapRenderer = mapRenderer;
    this.mainUI = mainUI;
  }

  /**
   * Result the list of extensions that's active/available.
   * @return {object} extensions - An array of string of extensions.
   */
  async listExtensions() {
    return this.extNameList;
  }

  async loadAllExtensionClient() {
    for (let extName of this.extNameList) {
      this.loadExtensionClient(extName);
    }
  }

  /**
   * Load the browser side of an extension.
   * This is usually called when the page loads by loadAllExtensionClient().
   * @param {String} extName - The name of the extension.
   */
  async loadExtensionClient(extName) {
    // ignore invalid extensions
    if (this.extNameList.includes(extName)) {
      const modulePath = `/static/extensions/${extName}/client.mjs`;
      const extModule = await import(modulePath);
      // TODO: check the type of extModule.default is a function.
      if (typeof extModule.default !== 'function') {
        throw `Default export of client extension ${name} is not a function.`;
      } else {
        this.extModules[extName] = extModule;
      }

      const extHelper = new ClientExtensionHelper(extName, this, this.socket);
      /* register APIs to extension helper. */
      this.extHelpers[extName] = extHelper;

      this.extObjects[extName] = new this.extModules[extName].default(extHelper);
      extHelper.setExt(this.extObjects[extName]);

      this.startExtensionClient(extName);
    }
  }

  /**
   * Start the browser side of an extension.
   * This should be called after loadExtensionClient().
   * Usually this is called after game start event in GameClient.
   * @param {String} extName - The name of the extension.
   */
  async startExtensionClient(extName) {
    if (typeof extName !== 'string') {
      console.error('Expected extName to be string');
      return;
    }
    if (!(extName in this.extObjects)) {
      console.error(`Extension ${extName} not loaded`);
      return;
    }
    await this.extHelpers[extName].gameStart(this.gameMap, this.gameState,
      this.gameClient, this.inputManager, this.mapRenderer, this.mainUI);
    if (typeof this.extObjects[extName].gameStart === 'function') {
      await this.extObjects[extName].gameStart();
    }
  }

  /**
   * This is called when the server side calls a client extension's API.
   */
  async onS2cAPICalled(msg) {
    const extName = msg.extName;
    const methodName = msg.methodName;
    const args = msg.args;
    // TODO: Pass it to the extension.
    if (!typeof extName === 'string') {
      return {'error': 'Expected extName to be string'};
    }
    if (!typeof methodName === 'string') {
      return {'error': 'Expected methodName to be string'};
    }
    if (!(extName in this.extNameList)) {
      return {'error': 'Extension name not found'};
    }
    if (!typeof args === 'object' || !Array.isArray(args)) {
      return {'error': 'args is not array'};
    }
    try {
      return await this.extHelpers[extName].onS2cAPICalled(methodName, args);
    } catch (e) {
      console.error(`Exception '${e}' calling S2cAPI '${methodName}' in '${extName}'`);
      return {'error': 'exception'};
    }
  }

  /**
   * This is called when server broadcasts something.
   * @param {object} msg - The message from the server.
   */
  async onExtensionBroadcast(msg) {
    // TODO: Pass message to extensions.
    const extName = msg.extName;
    if (!typeof extName === 'string') {
      return {
        "status": "failed",
        "message": "Expected extName to be string"
      };
    }
    if (!(extName in this.extNameList)) {
      return {
        "status": "failed",
        "message": "Extension name not found"
      };
    }

    const onExtBc = this.extObjects[extName].onExtensionBroadcast;
    if (!typeof onExtBc === 'function') {
      return {
        "status": "failed",
        "message": "Expected onExtensionBroadcast to be function"
      };
    }
    await onExtBc(msg);
  }

  /**
   * This is called when we received an update of our own position from the
   * server.
   */
  async notifySelfLocationUpdate(loc) {
    for (const name in this.extObjects) {
      if (typeof this.extObjects[name].onSelfLocationUpdated === 'function') {
        this.extObjects[name].onSelfLocationUpdated(loc);
      }
    }
  }
};

export default ClientExtensionManager;
