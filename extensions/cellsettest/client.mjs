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
    this.helper = helper;
    document.getElementById('ccs').addEventListener('click', () => {this.requestChangeCellset(this);});
    console.log("cellset extension loaded");
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

  onExtensionBroadcast(msg) {
    console.log(msg);
  }

  requestChangeCellset(client) {
    console.log("requestChangeCellset", client)
    client.helper.callStandaloneAPI('changeCellSet', null, 5000);
  }

  /**
   * The below static variable is used to configure the api functions that you want to expose to the client
   */
  static apis = {
    "SayHello": "clientHello",
  };
}

export default Client;
