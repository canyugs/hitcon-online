// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Map represents the whole world map of the game.
 * A map is multiple layers of 2D grid of cells.
 * Each cell of the map is usually a string or boolean.
 * The documentation for format of the map is found at the end of this file.
 */

import CellSet from './cellset.mjs';
import {randomChoice} from '../utility/random-tool.mjs';

/*
 * The map coordinate:
 * Be careful not to get confused with "canvas coordinate".
 * notation: (y, x)
 * unit: grid (or cell, in other words)
 *
 *           ...
 *
 *   (2,0)   (2,1)   (2,2)
 *
 *   (1,0)   (1,1)   (1,2)   ...
 *
 *   (0,0)   (0,1)   (0,2)
 */
class MapCoord {
  /**
   * Construct a map coordinate.
   * @constructor
   * @param {String} mapName
   * @param {Number} x - is a real number, which enables smooth moving
   * @param {Number} y - is a real number, which enables smooth moving
   */
  constructor(mapName, x, y) {
    if (mapName === undefined || x === undefined || y === undefined) {
      throw 'MapCoord should be initialized with three arguments';
    }
    if (typeof mapName !== 'string') {
      throw 'MapCoord.mapName is not a string';
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw 'MapCoord.x or y is not a Number';
    }
    this.mapName = mapName;
    this.x = x;
    this.y = y;
  }

  /**
   * Compare with another MapCoord.
   * @param {MapCoord} coord
   * @return {Boolean}
   */
  equalsTo(coord) {
    return this.mapName === coord.mapName &&
          this.x === coord.x &&
          this.y === coord.y;
  }

  /**
   * Get the Manhattan distance between two map coordinate.
   * @param {MapCoord} coord
   * @return {Number}
   */
  distanceTo1(coord) {
    if (this.mapName !== coord.mapName) return Infinity;
    return Math.abs(this.x - coord.x) + Math.abs(this.y - coord.y);
  }

  /**
   * Get the Euclidean distance between two map coordinate.
   * @param {MapCoord} coord
   * @return {Number}
   */
  distanceTo2(coord) {
    if (this.mapName !== coord.mapName) return Infinity;
    return Math.hypot(this.x - coord.x, this.y - coord.y);
  }

  /**
   * Check if mapCoord lies inside this cell set.
   * Does not care the mapName of mapCoord.
   * @param {CellSet} cellSet - The cell set.
   * @return {Boolean}
   */
  insideCellSet(cellSet) {
    const {x, y} = this;
    for (const cells of cellSet.cells) {
      if (x >= cells.x &&
          x < cells.x + (cells.w ?? 1) &&
          y >= cells.y &&
          y < cells.y + (cells.h ?? 1)) {
        return true;
      }
    }
    return false;
  }

  /**
   * The serialization used by JSON.stringify().
   * @return {Object}
   */
  toJSON() {
    return {mapName: this.mapName, x: this.x, y: this.y};
  }

  /**
   * Return a string that can be used as the key for occupying the space in
   * redis.
   * @return {string}
   */
  toRedisKey() {
    return 'cell_' + this.toSerializedStr();
  }

  /**
   * Deserialize a JSON object into MapCoord.
   * @param {Object} obj - the JSON object which has attribute "mapName", "x", "y"
   * @return {MapCoord}
   */
  static fromObject(obj) {
    return new MapCoord(obj.mapName, obj.x, obj.y);
  }

  /**
   * Copy this MapCoord.
   * @return {MapCoord}
   */
  copy() {
    return MapCoord.fromObject(this);
  }

  /**
   * Deserialize a string into MapCoord.
   * It should be in the format `${x}_${y}_${mapName}`
   * @param {String} s - The serialized string representation for the MapCoord.
   * @return {MapCoord} - Return undefined if failure.
   */
  static fromSerializedStr(s) {
    try {
      const idx1 = s.indexOf('_');
      if (idx1 < 0) {
        throw `can't find first '_'`;
      }
      const x = parseInt(s.substr(0, idx1));
      if (Number.isNaN(x)) {
        throw `x is NaN`;
      }
      s = s.substr(idx1+1);

      const idx2 = s.indexOf('_');
      if (idx2 < 0) {
        throw `can't find second '_'`;
      }
      const y = parseInt(s.substr(0, idx2));
      if (Number.isNaN(x)) {
        throw `x is NaN`;
      }
      s = s.substr(idx2+1);

      return new MapCoord(s, x, y);
    } catch (e) {
      console.warn(`MapCoord.fromSerializedStr(${s}) failed: `, e, e.stack);
      console.trace();
      return undefined;
    }
  }

  /**
   * Serialize a MapCoord into a string.
   * It should be in the format `${x}_${y}_${mapName}`
   * @return {String} s - The resulting string.
   */
  toSerializedStr() {
    return `${this.x}_${this.y}_${this.mapName}`;
  }
}


/**
 * The class that handles all map-related things.
 * It contains many _SingleGameMap.
 */
class GameMap {
  /**
   * @constructor
   * @param {GraphicAsset} asset - The asset that is used with this set of map.
   * @param {Object} maps - The JSON object representing the map.
   */
  constructor(asset, maps) {
    this.graphicAsset = asset;
    this._maps = new Map();
    this.spawnPointList = [];
    for (const [mapName, map] of Object.entries(maps)) {
      this._maps.set(mapName, new _SingleGameMap(asset, map, mapName));
    }
  }

  /**
   * Remove all the dynamic cell set.
   */
  removeAllDynamicCellSet() {
    for (const map of this._maps.values()) {
      map.removeAllDynamicCellSet();
    }
  }

  /**
   * Set a dynamic cell set of an underlying map.
   * @param {String} mapName
   * @param {CellSet} cellSet - A cell set object.
   */
  setDynamicCellSet(mapName, cellSet) {
    this._maps.get(mapName).setDynamicCellSet(cellSet);
  }

  /**
   * Update the cells of a dynamic cell set.
   * @param {String} mapName
   * @param {String} name - The name of dynamic cell set.
   * @param {Array} cells - This will overwrite current cellSet.cells.
   * @return {Boolean} success or not
   */
  updateDynamicCellSet(mapName, name, cells) {
    if (this._maps.has(mapName)) {
      return this._maps.get(mapName).updateDynamicCellSet(name, cells);
    }
    return false;
  }

  /**
   * Unset a dynamic cell set of an underlying map.
   * @param {String} mapName
   * @param {string} name - Name of the cell set.
   */
  unsetDynamicCellSet(mapName, name) {
    this._maps.get(mapName).unsetDynamicCellSet(name);
  }

  /**
   * Get the size of an underlying map.
   * @param {String} mapName
   * @return {Object} size - size.height and size.width are available.
   */
  getMapSize(mapName) {
    return this._maps.get(mapName).getMapSize();
  }

  /**
   * Get the raw cell content at the coordinate.
   * @param {MapCoord} coord - The map coordinate.
   * @param {String} layer - The raw layer designation.
   * @return {String} cell - The raw content of the cell. null if any error.
   */
  getCell(coord, layer) {
    if (!coord) return null;
    return this._maps.get(coord.mapName).getCell(coord, layer);
  }

  /**
   * Return the information required to render the a cell.
   * @param {MapCoord} coord - The map coordinate.
   * @param {String} layer - The raw layer designation.
   * @return {Object} info - An object denoting the image information. It
   * should contain:
   * - image: The HTMLImageElement for the image from which to render the tile.
   *   If we are not running on the browser or GraphicAsset.loadAssets() is not
   *   called. This field may be absent.
   * - imageRef: The name of the image in the asset config.
   * - srcX: The source X coordinate in the image above.
   * - srcY: The source Y coordinate in the image above.
   * - srcWidth: The width of the tile.
   * - srcHeight: The height of the tile.
   */
  getCellRenderInfo(coord, layer) {
    return this._maps.get(coord.mapName).getCellRenderInfo(coord, layer);
  }

  /**
   * Return the a specific cell set of every _SingleGameMap.
   * @param {String} csName - The name of the cell set.
   * @return {Map} ret - Key: mapName; Value: cell set.
   */
  getOriginalCellSet(csName) {
    const ret = new Map();
    for (const [mapName, map] of this._maps) {
      const cs = map.getOriginalCellSet(csName);
      if (cs) ret.set(mapName, cs);
    }
    return ret;
  }

  /**
   * Similar to getOriginalCellSet(), but matches cell set name's as prefix.
   * @param {String} csName - The prefix of cell set name.
   * @return {Map} ret - Key: mapName; Value: list of cell set.
   */
  getOriginalCellSetStartWith(csName) {
    const ret = new Map();
    for (const [mapName, map] of this._maps) {
      const cs = map.getOriginalCellSetStartWith(csName);
      if (cs.length > 0) ret.set(mapName, cs);
    }
    return ret;
  }

  /**
   * Get the Spawn Points from all maps.
   * @return {MapCoord} - A random spawn point with MapCoord type
   */
  getRandomSpawnPoint() {
    if (typeof this._spawnPointCache === 'undefined') {
      // Get all spawn points from all maps
      this._spawnPointCache = [];
      this._maps.forEach( (map) => {
        const newSpawnPoints = map.getSpawnPoints();
        this._spawnPointCache = this._spawnPointCache.concat(newSpawnPoints);
      });
    }

    return randomChoice(this._spawnPointCache);
  }
}

/**
 * The class that represents a single map.
 * The exported GameMap is composed of many _SingleGameMap.
 **/
class _SingleGameMap {
  /**
   * Construct an empty map.
   * @constructor
   * @param {GraphicAsset} asset - The asset that is used with this set of map.
   * @param {Object} map - The JSON object representing the map.
   * @param {String} mapName - The name of this single map.
   */
  constructor(asset, map, mapName) {
    this.graphicAsset = asset;
    this.gameMap = map;
    if (!this.gameMap) {
      throw 'No map json supplied with new _SingleGameMap()';
    }
    this.mapName = mapName;

    // If cellSet is not in the map data, add it back.
    this.gameMap.cellSets = (this.gameMap.cellSets ?? []);

    // ensure this.gameMap.cellSets are `CellSet` instance
    for (const [i, cellSet] of this.gameMap.cellSets.entries()) {
      cellSet.dynamic = false;
      this.gameMap.cellSets[i] = CellSet.fromObject(cellSet);
    }

    // initialize dynamic cell set
    this.dynamicCellSet = {};

    // construct layerToCellSet for efficient lookup
    this.layerToCellSet = new Map();
    for (const cs of this.gameMap.cellSets) {
      this._setCellSet(cs);
    }
  }

  /**
   * Return a cell set in the original map.
   * @param {string} csName - The name of the cell set.
   * @return {CellSet} The cell set. Return undefined if not found.
   */
  getOriginalCellSet(csName) {
    return this.gameMap.cellSets.find((cs) => cs.name === csName);
  }

  /**
   * Similar to getOriginalCellSet(), but matches cell set name's as prefix.
   * @param {String} csName - The prefix of cell set name.
   * @return {Array} The cell sets. Return empty array if not found.
   */
  getOriginalCellSetStartWith(csName) {
    return this.gameMap.cellSets.filter((cs) => cs.name.startsWith(csName));
  }

  /**
   * Remove all the dynamic cell set.
   */
  removeAllDynamicCellSet() {
    this.dynamicCellSet = {};
    const l2cs = this.layerToCellSet; // alias
    for (const layerName of l2cs.keys()) {
      l2cs.set(layerName, l2cs.get(layerName).filter((cs) => (!cs.dynamic)));
    }
  }

  /**
   * Set a cell set. `cellSet` can be static or dynamic cell set.
   * Should be called internally. Only setDynamicCellSet is publicly available.
   * @param {CellSet} cellSet - The cell set to be added.
   */
  _setCellSet(cellSet) {
    // just in case if cellSet is not a `CellSet` instance
    // TODO: a more correct check
    if (typeof cellSet.dynamic === 'undefined') {
      throw 'parameter `cellSet` is not an instance of class CellSet';
    }

    if (cellSet.dynamic) {
      this.dynamicCellSet[cellSet.name] = cellSet;
    }

    for (const layerName of Object.keys(cellSet.layers)) {
      const l2cs = this.layerToCellSet; // alias

      if (!l2cs.has(layerName)) l2cs.set(layerName, []);

      l2cs.get(layerName).push(cellSet);
      l2cs.get(layerName).sort(
          (a, b) => (a.priority !== b.priority) ?
                    ((b.priority) - (a.priority)) :
                    (b.dynamic ? 1 : -1),
      );
    }
  }

  /**
   * Set a dynamic cell set.
   * @param {CellSet} cellSet - The cell set to be added.
   */
  setDynamicCellSet(cellSet) {
    // just in case if cellSet is not a `CellSet` instance
    // TODO: a more correct check
    if (typeof cellSet.dynamic === 'undefined') {
      throw 'parameter `cellSet` is not an instance of class CellSet';
    }

    if (cellSet.dynamic === false) {
      throw 'parameter `cellSet` is not a dynamic cell set';
    }

    this._setCellSet(cellSet);
  }

  /**
   * Update the cells of a dynamic cell set.
   * @param {String} name - The name of dynamic cell set.
   * @param {Array} cells - This will overwrite current cellSet.cells.
   * @return {Boolean} success or not
   */
  updateDynamicCellSet(name, cells) {
    if (name in this.dynamicCellSet) {
      // Note that no need to update layerToCellSet since the referenced object
      // is the same. Modify this.dynamicCellSet is sufficient.
      this.dynamicCellSet[name].cells = cells;
      return true;
    }
    return false;
  }

  /**
   * Unset a dynamic cell set.
   * @param {string} name - Name of the cell set.
   */
  unsetDynamicCellSet(name) {
    const l2cs = this.layerToCellSet; // alias
    for (const layerName of Object.keys(this.dynamicCellSet[name].layers)) {
      l2cs.set(layerName, l2cs.get(layerName).filter((cs) => (cs.name !== name)));
    }

    delete this.dynamicCellSet[name];
  }

  /**
   * Get the size of the entire map.
   * @return {Object} size - size.height and size.width are available.
   */
  getMapSize() {
    return {width: this.gameMap.width, height: this.gameMap.height};
  }

  /**
   * Get the raw cell content at the coordinate.
   * @param {MapCoord} coord - The map coordinate.
   * @param {String} layer - The raw layer designation.
   * @return {String} cell - The raw content of the cell. `null` if not exist.
   */
  getCell(coord, layer) {
    const {x, y} = coord;
    if (x < 0 || x >= this.gameMap.width ||
        y < 0 || y >= this.gameMap.height) {
      throw 'map index out of bound';
    }

    // check if this layer is overwritten by cell sets
    if (this.layerToCellSet.has(layer)) {
      for (const cs of this.layerToCellSet.get(layer)) {
        if (cs.containsMapCoord(coord)) {
          return cs.layers[layer];
        }
      }
    }

    // If no cell sets overwrite this mapCoord, check the original layer.
    if (layer in this.gameMap) {
      return this.gameMap[layer][y*this.gameMap.width + x];
    }

    return null;
  }

  /**
   * Return the information required to render the a cell.
   * @param {MapCoord} coord - The map coordinate.
   * @param {String} layer - The raw layer designation.
   * @return {Object} info - Return `null` if not exist.
   * An object denoting the image information. It should contain:
   * - image: The HTMLImageElement for the image from which to render the tile.
   *   If we are not running on the browser or GraphicAsset.loadAssets() is not
   *   called. This field may be absent.
   * - imageRef: The name of the image in the asset config.
   * - srcX: The source X coordinate in the image above.
   * - srcY: The source Y coordinate in the image above.
   * - srcWidth: The width of the tile.
   * - srcHeight: The height of the tile.
   */
  getCellRenderInfo(coord, layer) {
    const tile = this.getCell(coord, layer);
    if (tile === null) return null;
    return this.graphicAsset.getTile(layer, tile);
  }

  /**
   * Get spawn points of single map.
   * If We have a spawn point area from (1,1) (1,5) (5,1) (5,5),
   * we split it here to become 16 spawn points.
   * @return {Array} The map coordinates inside 'spawnPoint' cell set.
   */
  getSpawnPoints() {
    if (typeof this._spawnPointList === 'undefined') {
      const spawnPointsCellSet = this.getOriginalCellSet('spawnPoint');
      this._spawnPointList = [];
      if (typeof spawnPointsCellSet != 'undefined') {
        for (const cell of spawnPointsCellSet.cells) {
          const w = (cell.w ?? 1);
          const h = (cell.h ?? 1);
          for (let i = 0; i < w; ++i) {
            for (let j = 0; j < h; ++j) {
              this._spawnPointList.push(new MapCoord(this.mapName, cell.x + i, cell.y + j));
            }
          }
        }
      }
    }
    return this._spawnPointList;
  }
}

export default GameMap;

export {MapCoord, GameMap};

/*
Sample format for the map:
{
  world1: {
    "ground": ["ground","ground","ground","ground","ground","ground"],
    "wall": [true, true, true, false, false, false],
    "object": [null, null, null, "bar0", null, null],
    "startX": 0,
    "startY": 0,
    "width": 3,
    "height": 2
    "cellSets": [
      {
        name: "meeting01",
        priority: 1,
        cells: [
          { x: 5, y: 6, w: 3, h: 3 },
          { x: 1, y: 2 }
        ],
        layers: {
          "meeting": "example01"
        },
      }
    ]
  },
  world2: {
    "ground": ["ground"],
    "wall": [false],
    "object": [null],
    "startX": 0,
    "startY": 0,
    "width": 1,
    "height": 1
  }
}
*/
