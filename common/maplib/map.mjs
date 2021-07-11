// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Map represents the whole world map of the game.
 * A map is multiple layers of 2D grid of cells.
 * Each cell of the map is usually a string or boolean.
 * The documentation for format of the map is found at the end of this file.
 */


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
    return `cell-${this.x}-${this.y}-${this.mapName}`;
  }

  /**
   * Deserialize a JSON object into MapCoord.
   * @param {Object} obj - the JSON object which has attribute "mapName", "x", "y"
   * @return {MapCoord}
   */
  static fromObject(obj) {
    return new MapCoord(obj.mapName, obj.x, obj.y);
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
    for (const [mapName, map] of Object.entries(maps)) {
      this._maps.set(mapName, new _SingleGameMap(asset, map));
    }
  }

  /**
   * Remove all the dynamic cell set.
   */
  removeAllDynamicCellSet() {
    for (const map of this._maps) {
      map.removeAllDynamicCellSet();
    }
  }

  /**
   * Set a dynamic cell set of an underlying map.
   * @param {String} mapName
   * @param {Object} cellSet - A cell set object.
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
   * @return {String} cell - The raw content of the cell. '' if any error.
   */
  getCell(coord, layer) {
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
  **/

  getOriginalCellSetStartWith(csName) {
    const ret = new Map();
    for (const [mapName, map] of this._maps) {
      const cs = map.getOriginalCellSetStartWith(csName);
      if (cs.length > 0) ret.set(mapName, cs);
    }
    return ret;
  }

  getSpawnPoint(mapName){
    return this._maps.get(mapName).getSpawnPoint();
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
   */
  constructor(asset, map) {
    this.graphicAsset = asset;
    this.gameMap = map;
    if (!this.gameMap) {
      throw 'No map json supplied with new _SingleGameMap()';
    }

    this.dynamicCellSet = {};
    //this.spawnpointCellSet = [];
    this.spawnPointList = [];
    this.staticCellSet = new Map();
    this.layerToCellSet = new Map();
    // If cellSet is not in the map data, add it back.
    if (typeof this.gameMap.cellSet === 'undefined') {
      this.gameMap.cellSet = [];
    }
    for (const cellSet of this.gameMap.cellSet) {
      for (const layer of cellSet.layers) {
        if (!this.layerToCellSet.has(Object.keys(layer)[0])) {
          this.layerToCellSet.set(Object.keys(layer)[0], []);
        }
        this.layerToCellSet.get(Object.keys(layer)[0]).push({
          name: cellSet.name,
          cells: cellSet.cells,
          priority: cellSet.priority,
          cellContent: Object.values(layer)[0],
          dynamic: false
        });
        this.staticCellSet.set(cellSet.name, cellSet.cells);
      }
    }
    for (const k of this.layerToCellSet.keys()) {
      this.layerToCellSet.get(k).sort((first, second) => (second.priority ?? -1) - (first.priority ?? -1));
    }
  }

  /**
   * Return a cell set in the original map.
   * @param {string} csName - The name of the cell set.
   * @return {Object} cellset - The cell set.
   * Return undefined if not found.
   */
  getOriginalCellSet(csName) {
    return this.gameMap.cellSet.find((cs) => cs.name === csName);
  }

  /**
   * Similar to getOriginalCellSet(), but matches cell set name's as prefix.
   * @param {String} csName - The prefix of cell set name.
   * @return {Map} ret - Key: mapName; Value: cell set.
   * Return undefined if not found.
   */
  getOriginalCellSetStartWith(csName) {
    return this.gameMap.cellSet.filter((cs) => cs.name.startsWith(csName));
  }

  /**
   * Remove all the dynamic cell set.
   */
  removeAllDynamicCellSet() {
    this.dynamicCellSet = {};
    for(let k of this.layerToCellSet.keys()){
      this.layerToCellSet.set(k, this.layerToCellSet.get(k).filter(cs => !cs.dynamic));
    }
  }

  /**
   * Set a dynamic cell set.
   * @param {Object} cellSet - A cell set object.
   */
  setDynamicCellSet(cellSet) {
    this.dynamicCellSet[cellSet.name] = cellSet;
    for (const layer of cellSet.layers) {
      if (!this.layerToCellSet.has(Object.keys(layer)[0])) {
        this.layerToCellSet.set(Object.keys(layer)[0], []);
      }
      this.layerToCellSet.get(Object.keys(layer)[0]).push({
        name: cellSet.name,
        cells: cellSet.cells,
        priority: cellSet.priority,
        cellContent: Object.values(layer)[0],
        dynamic: true
      });
      this.layerToCellSet.get(Object.keys(layer)[0]).sort((first, second) => (second.priority ?? -1) - (first.priority ?? -1));
    }
  }

  /**
   * Update the cells of a dynamic cell set.
   * @param {String} name - The name of dynamic cell set.
   * @param {Array} cells - This will overwrite current cellSet.cells.
   * @return {Boolean} success or not
   */
  updateDynamicCellSet(name, cells) {
    if (name in this.dynamicCellSet) {
      for (const layer of this.dynamicCellSet[name].layers) {
        this.layerToCellSet.get(Object.keys(layer)[0]).find((cellset) => cellset.name === name).cells = cells;
      }
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
    for(let layer of this.dynamicCellSet[name].layers){
      this.layerToCellSet.set(Object.keys(layer)[0], this.layerToCellSet.get(Object.keys(layer)[0]).filter(cs => cs.name != name));
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

    if(this.layerToCellSet.has(layer)){
      for(let cellSet of this.layerToCellSet.get(layer)){
        for(let cells of cellSet.cells){
          if(x >= cells.x && x < cells.x + (cells.w ?? 1) && y >= cells.y && y < cells.y + (cells.h ?? 1)){
            return cellSet.cellContent;
          }
        }
      }
    }
    if (layer in this.gameMap) {
      const cell = this.gameMap[layer][y*this.gameMap.width + x];
      return cell;
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
   * Expand Cell Set List.
   * @param {string} cellSetName
   * @return {list} Cell Set points - A list of cell set points.
   */
  expandCellSet(cellSetName) {
    let expandList = [];
    if(this.staticCellSet.has(cellSetName))
    for (const cell in this.staticCellSet.get(cellSetName)) {
      const w = (cell.w ?? 1), h = (cell.h ?? 1);
      for (let i = 0; i < w; ++i) {
        for (let j = 0; j < h; ++j) {
          expandList.push({x: cell.x + i, y: cell.y + j});
        }
      }
    }
    return expandList;
  }

  /**
   * Get Spawn Point List.
   * @return {list} spawn point - A list of the spawn point.
   */
  getSpawnPoint(){
    if (this.spawnPointList == 0) {
      this.spawnPointList = this.expandCellSet("SpawnPoint");
    }
    return this.spawnPointList;
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
    "cellSet": [
      {
        name: "meeting01",
        priority: 1,
        cells: [
          { x: 5, y: 6, w: 3, h: 3 },
          { x: 1, y: 2 }
        ],
        layers: [
          {"meeting": "example01"},
        ],
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
TODO: Add more elaborate documentation on what cellSet is.
*/
