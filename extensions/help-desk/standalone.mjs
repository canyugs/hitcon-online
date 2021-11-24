// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../../common/maplib/map.mjs';

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
    this.locations = {
      'serviceDesk': new MapCoord('world7', 7, 3),
    };
  };

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  async c2s_teleport(player, location) {
    const {playerID} = player;
    if (typeof playerID !== 'string') {
      console.warn('Invaild PlayerID', player);
      return;
    }
    const target = this.locations[location];
    if (target === undefined) {
      console.error('Location not found');
      return;
    }
    await this.helper.teleport(playerID, target, true);
  }

  async c2s_getAvailableLocations() {
    return this.locations;
  }

  /**
   * Returns true if this extension have a standalone part.
   * If this returns false, the constructor for Standalone will not be called.
   * Otherwise, a Standalone object is instanciated.
   * @return {Boolean} haveStandalone - See above.
   */
  static haveStandalone() {
    return true;
  }
}

export default Standalone;
