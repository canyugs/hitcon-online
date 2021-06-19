// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import path from 'path';
import url from 'url';

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');

import assert from 'assert';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

import ExtensionHelper from './extension-helper.mjs';

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
   */
  constructor(directory, broadcaster) {
    this.dir = directory;
    this.broadcaster = broadcaster;
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

    this.ext[name].standaloneHelper = new ExtensionHelper(
        this, this.dir, this.broadcaster, name);
    await this.ext[name].standaloneHelper.asyncConstructor();
    this.ext[name].standalone = new this.ext[name].standaloneClass(
        this.ext[name].standaloneHelper);
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
   * Return an array of String that is the list of extensions available.
   * @return {object} names - An array of String, each is an available
   * extension.
   */
  listExtensions() {
    // TODO: Check if these extensions really exists.
    return config.get('ext.enabled');
  }

  /**
   * Collect and return the partials from all the extensions listed.
   * @param {Object} names - An array of extension name.
   * @return {Object} partials - An object, each element is the array of paths
   * for each location.
   */
  async collectPartials(names) {
    let result = {};
    for (const name of names) {
      // Load the classes if they are not loaded.
      await this.ensureClass(name);
      let p = this.ext[name].standaloneClass.getPartials();
      for (const loc in p) {
        if (!(loc in result)) {
          result[loc] = [];
        }
        result[loc].push(path.resolve(__dirname + `/../../extensions/${name}/${p[loc]}`));
      }
    }
    return result;
  }
}

export default ExtensionManager;
