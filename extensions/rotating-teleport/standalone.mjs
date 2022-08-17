// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../../common/maplib/map.mjs';

/**
 * TODO: jsdoc
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
    // empty
  }

  async _rotatingTeleport() {}

  async s2s_teleport(extName, playerID, destination) {
    const fromPlace = this.helper.gameState.getPlayer(playerID).mapCoord;
    const toPlace = MapCoord.fromObject(destination);
    if (await this.helper.teleport(playerID, toPlace, true)) {
      // TODO: check if the performance of manually calling s2c api to all clients is too bad
      for (const [, {playerID: playerID_}] of this.helper.gameState.getPlayers()) {
        this.helper.callS2cAPI(
            playerID_,
            'rotating-teleport',
            'tryStartRotatingTeleportAnimation',
            this.helper.defaultTimeout,
            playerID,
            fromPlace,
            toPlace,
        );
      }
    }
  }

  async s2s_sf_rotatingTeleport() {}
}

export default Standalone;
