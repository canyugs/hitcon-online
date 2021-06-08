// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
    void helper;
    console.assert('Not implemented');
    this.socket = io();
  }

  /**
   * Returns true if this extension have a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} haveClient - See above.
   */
  static haveClient() {
    return false;
  }

  clientHello(message) {
    console.log('Client Says: Hello ', message);
    return 'Server is able to call client API';
  }

  static apis = {
    "SayHello": "clientHello",
  };
}

export default Client;
