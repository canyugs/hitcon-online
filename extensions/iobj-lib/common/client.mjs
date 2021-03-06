// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// NOTE: Not used, this ext is just a library for server side.

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
  }

  /**
   * Returns true if this extension has a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} hasClient - See above.
   */
  static hasClient() {
    return false;
  }
};

export default Client;
