// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
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
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    this.helper.gameState.registerOnPlayerUpdate((msg) => {
      this.onPlayerUpdate(msg);
    });
  }

  /**
   * Called when a player moves or updates the info.
   */
  async onPlayerUpdate(msg) {
    if (msg.ghostMode === true) {
      // Ignore ghost mode updates.
      return;
    }
    if (typeof msg.playerID !== 'string') {
      console.warn('Invalid PlayerSyncMessage with non-string msg.playerID', msg, msg.playerID);
      return;
    }
    const loc = msg.mapCoord;
    let cellVal = null;
    try {
      cellVal = this.helper.gameMap.getCell(loc, 'portal');
    } catch (e) {
      console.warn('Exception when trying to get cell value in map-portal.onPlayerUpdate()', e, e.stack, msg);
      return;
    }
    let target = null;
    try {
      if (typeof cellVal === 'string') {
        // Decode it into the target MapCoord.
        target = MapCoord.fromSerializedStr(cellVal);
      } else if (typeof cellVal === 'object' && cellVal !== null) {
        target = MapCoord.fromObject(cellVal);
      }
    } catch (e) {
      console.warn('Failed to decode cell value in map-portal.onPlayerUpdate()', cellVal, e, e.stack);
    }
    if (target === null || typeof target === 'undefined') {
      // Not target, no need to teleport.
      return;
    }
    await this.helper.teleport(msg.playerID, target);
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
