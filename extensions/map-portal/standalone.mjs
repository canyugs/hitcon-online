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
      try {
        this.onPlayerUpdate(msg);
      } catch (e) {
        console.error('map-portal failure: ', e, e.stack);
      }
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
    if (typeof loc === 'undefined') {
      // No location? Just skip.
      return;
    }
    let cellVal = null;
    try {
      cellVal = this.helper.gameMap.getCell(loc, 'portal');
    } catch (e) {
      console.warn('Exception when trying to get cell value in map-portal.onPlayerUpdate()', e, e.stack, msg);
      return;
    }
    let target = null;
    let perm = null;
    try {
      if (typeof cellVal === 'string') {
        // Decode it into the target MapCoord.
        const vals = cellVal.split('@');
        if (vals.length === 1) {
          target = MapCoord.fromSerializedStr(vals[0]);
        } else if (vals.length === 2) {
          perm = vals[0].split(',');
          target = MapCoord.fromSerializedStr(vals[1]);
        }
      } else if (typeof cellVal === 'object' && cellVal !== null) {
        target = MapCoord.fromObject(cellVal);
        if (typeof cellVal.perm === 'object' && Array.isArray(cellVal.perm)) {
          perm = cellVal.perm;
        }
      }
    } catch (e) {
      console.warn('Failed to decode cell value in map-portal.onPlayerUpdate()', cellVal, e, e.stack);
    }
    if (target === null || typeof target === 'undefined') {
      // Not target, no need to teleport.
      return;
    }
    // If permission is required, check it.
    if (perm !== null) {
      let allowed = false;
      const permission = await this.helper.getToken(msg.playerID);
      let scp = permission.scp;
      if (!Array.isArray(scp)) {
        scp = permission.scope;
      }
      if (Array.isArray(scp)) {
        for (const p of perm) {
          if (scp.includes(p)) {
            allowed = true;
            break;
          }
        }
      } else {
        console.warn('jwt no scope: ', permission);
      }
      if (!allowed) {
        this.helper.callS2cAPI(msg.playerID, 'notification', 'showNotification', 5000, 'No permission');
        return;
      }
    }
    await this.helper.teleport(msg.playerID, target, true);
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
