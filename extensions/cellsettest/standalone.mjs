// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from '../../common/maplib/cellset.mjs';

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
    this.helper = helper;
    this.state = 0;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    this.helper.registerOnPlayerUpdate((msg) => {
      console.log('standalone extension received: ', msg);
    });
    this.helper.registerOnCellSetBroadcast((cset) => {
      console.log('standalone extension received: ', cset);
    });
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

  c2s_changeCellSet() {
    switch (this.state) {
      case 0:
        this.helper.broadcastCellSetUpdateToAllUser(
            'set', // operation type
            'world1',
            CellSet.fromObject({
              name: 'testDynamic',
              priority: 4,
              cells: [{'x': 10, 'y': 10, 'h': 8, 'w': 8}],
              layers: {ground: 'P'},
              dynamic: true,
            }),
        );
        this.state = 1;
        break;

      case 1:
        this.helper.broadcastCellSetUpdateToAllUser(
            'update', // operation type
            'world1',
            CellSet.fromObject({
              name: 'testDynamic',
              cells: [
                {'x': 10, 'y': 10, 'h': 8, 'w': 8},
                {'x': 12, 'y': 5, 'h': 4, 'w': 4},
              ],
            }),
        );
        this.state = 2;
        break;

      case 2:
        this.helper.broadcastCellSetUpdateToAllUser(
            'unset', // operation type
            'world1',
            CellSet.fromObject({
              name: 'testDynamic',
            }),
        );
        this.state = 0;
        break;

      default:
        console.error(`invalid \`this.state\`, value = ${this.state}`);
    }
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }
}

export default Standalone;
