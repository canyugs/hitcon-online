// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import _axios from 'axios';
import ClientExtensionHelper from './client-extension-helper.mjs';

const axios = _axios.create({
    baseURL: 'http://localhost:5000',
    timeout: 1000
});

/**
 * This class manages the extensions on the client side.
 * It is in charge of loading them and providing them with a helper
 * class and other APIs to access browser side resources.
 */
class ClientExtensionManager {
  /**
   * Create the ClientExtensionManager.
   * @constructor
   */
  constructor(extensionName) {
    this.extModules = {};
    this.extHelpers = {};
  }

  /**
   * Result the list of extensions that's active/available.
   * @return {object} extensions - An array of string of extensions.
   */
  async listExtensions() {
    // TODO: Call server through '/list_extensions' to get the result.
    const extList = await axios.get('/list_extensions');
    this.extNameList = JSON.parse(extList);
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
      this.extModules[extName] = extModule;

      const extHelper = new ClientExtensionHelper(extName);
      /* register APIs to extension helper. */
      this.extHelpers[extName] = extHelper;
    }
    // TODO: Load the extension with dynamic import.
  }

  /**
   * Start the browser side of an extension.
   * This should be called after loadExtensionClient().
   * Usually this is called after game start event in GameClient.
   * @param {String} extName - The name of the extension.
   */
  async startExtensionClient(extName) {
    // TODO: Call gameStart() on each of the extensions.
    if (this.extNameList.includes(extName)) {
      this.extModules[extName].gameStart();
    }
  }
};

export default ClientExtensionManager;
