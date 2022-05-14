// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from '../../common/maplib/cellset.mjs';
import {LAYER_BOMB, BOMB_COOLDOWN} from './common/client.mjs';

const BOMB_COUNTDOWN = 3000; // millisecond

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
    this.cooldown = false;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    // get the default arena of every map
    this.arenaOfMaps = this.helper.gameMap.getOriginalCellSetStartWith('bombmanArena');
    this.obstaclesOfMaps = this.helper.gameMap.getOriginalCellSetStartWith('bombmanObstacles');

    // set dynamic cell set: bombmanHasBomb
    this.bombCells = new Map(); // key: a unique bomb ID; value: the cell
    this.bombID = 0;
    for (const mapName of this.arenaOfMaps.keys()) {
      await this.helper.broadcastCellSetUpdateToAllUser(
          'set', // operation type
          mapName,
          CellSet.fromObject({
            name: LAYER_BOMB.layerName,
            priority: 3,
            cells: Array.from(this.bombCells.values()),
            layers: {[LAYER_BOMB.layerName]: 'B'},
            dynamic: true,
          }),
      );
    }
  }

  /**
   * Client tries to place a bomb at mapCoord.
   * The server returns true on success.
   * @param {Object} player - (TODO: needs docs)
   * @param {MapCoord} mapCoord - The bomb position.
   * @return {Boolean} success or not
   */
  async c2s_placeBomb(player, mapCoord) {
    // mapCoord has to be inside an arena
    // TODO: use the utility function in maplib if there is such function
    let inside = false;
    for (const {cells} of this.arenaOfMaps.get(mapCoord.mapName)) {
      for (const cell of cells) {
        const width = cell.w ?? 1;
        const height = cell.h ?? 1;
        if (cell.x <= mapCoord.x && mapCoord.x < cell.x + width &&
            cell.y <= mapCoord.y && mapCoord.y < cell.y + height) {
          inside = true;
        }
      }
      if (inside) break;
    }
    if (!inside) return;

    // TODO: check if the player can set a bomb or not
    if (this.cooldown) return;
    this.cooldown = true;
    setTimeout(()=>{
      this.cooldown = false;
    }, BOMB_COOLDOWN);
    const bombID = this.bombID++;
    this.bombCells.set(bombID, {x: mapCoord.x, y: mapCoord.y});
    await this.helper.broadcastCellSetUpdateToAllUser(
        'update', // operation type
        mapCoord.mapName,
        CellSet.fromObject({
          name: LAYER_BOMB.layerName,
          cells: Array.from(this.bombCells.values()),
        }),
    );

    // setTimeout to remove bomb
    setTimeout(async (bombID) => {
      this.bombCells.delete(bombID);
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update', // operation type
          mapCoord.mapName,
          CellSet.fromObject({
            name: LAYER_BOMB.layerName,
            cells: Array.from(this.bombCells.values()),
          }),
      );
    }, BOMB_COUNTDOWN, bombID);

    return true;
  }
}

export default Standalone;
