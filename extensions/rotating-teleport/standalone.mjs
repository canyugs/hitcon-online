// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../../common/maplib/map.mjs';


const LAYER_NAME = 'rotatingTeleport';
const SEPARATOR = '.';
const ACTION_IN = 'in';
const ACTION_OUT = 'out';


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
    this.teleportLookupTable = new Map(); // key: the ID of the portal, value: the destination

    this.parseLayer();

    // teleport the player if he/she steps on a portal
    this.helper.gameState.registerOnPlayerUpdate((msg) => {
      if (typeof msg.playerID !== 'string') return;
      if (typeof msg.mapCoord !== 'object') return;

      // if he/she is not being teleported, check if steps on a portal defined by our extension
      const layerValue = this.helper.gameMap.getCell(msg.mapCoord, LAYER_NAME);
      if (layerValue === null) return;
      const [id, action] = layerValue.split(SEPARATOR);
      if (action !== ACTION_IN) return;

      // rotating teleport
      const targetPlace = this.teleportLookupTable.get(id);
      this._rotatingTeleport(msg.playerID, targetPlace);
    });
  }

  /**
   * Parse the configuration
   * @return {Boolean} - successful or not
   */
  parseLayer() {
    // parse the layers and build the lookup table
    const inIDs = new Set();
    for (const [mapName, map] of this.helper.gameMap.getMaps()) {
      const {width, height} = map.getMapSize();
      for (let x = 0; x < width; ++x) {
        for (let y = 0; y < height; ++y) {
          const coord = new MapCoord(mapName, x, y);
          const layerValue = map.getCell(coord, LAYER_NAME);
          if (layerValue === null) continue;
          console.assert(typeof layerValue === 'string');
          const [id, action] = layerValue.split(SEPARATOR);
          switch (action) {
            case ACTION_IN:
              inIDs.add(id);
              break;
            case ACTION_OUT:
              this.teleportLookupTable.set(id, coord);
              break;
            default:
              console.error(`[rotating-teleport] invalid layer value ${layerValue}`);
          }
        }
      }
    }
    // check
    if (inIDs.size !== this.teleportLookupTable.size) {
      console.error(`[rotating-teleport] has ${inIDs.size} 'in' portal but has ${this.teleportLookupTable.size} 'out' portal`);
      return false;
    }
    for (const id of inIDs) {
      if (!this.teleportLookupTable.has(id)) {
        console.error(`[rotating-teleport] missing 'out' portal of 'in' portal ${id}`);
        return false;
      }
    }

    return true;
  }

  async _rotatingTeleport(playerID, destination) {
    const fromPlace = this.helper.gameState.getPlayer(playerID).mapCoord;
    const toPlace = MapCoord.fromObject(destination);
    const result = await this.helper.teleport(playerID, toPlace, true);
    if (result) {
      this.helper.broadcastToAllUser({playerID, fromPlace, toPlace});
    }
  }

  async s2s_teleport(extName, playerID, destination) {
    await this._rotatingTeleport(playerID, destination);
  }

  async s2s_sf_rotatingTeleport() {}
}

export default Standalone;
