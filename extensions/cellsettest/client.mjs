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

    window.testCellSet = this.requestChangeCellset.bind(this);
  }

  requestChangeCellset() {
    console.log('requestChangeCellset');
    this.helper.callC2sAPI('cellsettest', 'changeCellSet', null, 5000);
  }
}

export default Client;
