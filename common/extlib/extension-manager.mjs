// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * This class manages the extensions, allowing callers to start an instance of
 * the specified extension's server, or call an extension's API.
 */
class ExtensionManager {
  /**
   * Create the ExtensionManager.
   * @constructor
   * @param {Directory} directory - An RPC Directory instance.
   */
  constructor(directory) {
    void directory;
    assert.fail('Not implemented');
  }

  /**
   * Initialize the extension manager.
   * This adds an API in the http server to list the extensions.
   * @param {App} app - An express.js (or compatible) app.
   */
  async initialize(app) {
    app.get('/list_extensions', (req, res) => {
      res.json(this.listExtensions());
    });
  }

  /**
   * Create the extension server for the specified extension, but does
   * NOT start it.
   * This function is usually called in the construction phase of the
   * parent process. After all services have been created and registered,
   * then we call startExtensionService() below.
   * Note that the extension server is always created in the current
   * calling process.
   * @param {String} name - The name of the extension.
   * @return {Boolean} success - Return true if successful.
   */
  createExtensionService(name) {
    void name;
    assert.fail('Not implemented');
    return false;
  }

  /**
   * Start the extension server for the specified extension.
   * createExtensionService() should have been called before calling this.
   * This expects all services to already be registered.
   * Note that the extension server is always started in the current
   * calling process.
   * This and createExtensionService() should be called in the same process.
   * @param {String} name - The name of the extension.
   * @return {Boolean} success - Return true if successful.
   */
  startExtensionService(name) {
    void name;
    assert.fail('Not implemented');
    return false;
  }

  /**
   * Return an array of String that is the list of extensions available.
   * @return {object} names - An array of String, each is an available
   * extension.
   */
  listExtensions() {
    assert.fail('Not implemented');
    return [];
  }
}

export default ExtensionManager;
