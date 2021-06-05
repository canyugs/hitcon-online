// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    void helper;
    assert.fail('Not implemented');
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  /**
   * Returns true if this extension have a standalone part.
   * If this returns false, the constructor for Standalone will not be called.
   * Otherwise, a Standalone object is instanciated.
   * @return {Boolean} haveStandalone - See above.
   */
  static haveStandalone() {
    return false;
  }
}

export default Standalone;
