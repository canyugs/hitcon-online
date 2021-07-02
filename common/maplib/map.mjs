// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Map represents the whole world map of the game.
 * A map is multiple layers of 2D grid of cells.
 * Each cell of the map is usually a string or boolean.
 * The documentation for format of the map is found at the end of this file.
 */
class GameMap {
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
      throw 'No map json supplied with new GameMap()';
    }

    this.dynamicCellSet = {};
    this.layerToCellSet = new Map();
    // If cellSet is not in the map data, add it back.
    if (typeof this.gameMap.cellSet === 'undefined') {
      this.gameMap.cellSet = [];
    }
    for(let cellSet of this.gameMap.cellSet){
      for(let layer of cellSet.layers){
        if(!this.layerToCellSet.has(Object.keys(layer)[0])){
          this.layerToCellSet.set(Object.keys(layer)[0], []);
        }
        this.layerToCellSet.get(Object.keys(layer)[0]).push({ 
          name: cellSet.name, 
          cells: cellSet.cells, 
          priority: cellSet.priority, 
          cellContent: Object.values(layer)[0],
          dynamic: false
        });
      }
    }
    for(let k of this.layerToCellSet.keys()){
      this.layerToCellSet.get(k).sort((first, second) => (second.priority ?? -1) - (first.priority ?? -1));
    }
  }

  /**
   * Return a cell set in the original map.
   * @param {string} name - The name of the cell set.
   * @return {Object} cellset - The cell set.
   * Return undefined if not found.
   */
  getOriginalCellSet() {
    throw 'Not implemented';
    return undefined;
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

    for(let layer of cellSet.layers){
      if(!this.layerToCellSet.has(Object.keys(layer)[0])){
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
   * @param {String} layer - The raw layer designation.
   * @param {Number} x - The X coordinate, must be integer.
   * @param {Number} y - The Y coordinate, must be integer.
   * @return {String} cell - The raw content of the cell. '' if any error.
   */
  getCell(layer, x, y) {
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
    
    if(layer in this.gameMap){
      const cell = this.gameMap[layer][y*this.gameMap.width + x];
      return cell;
    }
    return null;
  }

  /**
   * Return the information required to render the a cell.
   * @param {String} layer - The raw layer designation.
   * @param {Number} x - The X coordinate, must be integer.
   * @param {Number} y - The Y coordinate, must be integer.
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
  getCellRenderInfo(layer, x, y) {
    const tile = this.getCell(layer, x, y);
    return this.graphicAsset.getTile(layer, tile);
  }
}

class GameMapMock {
  /**
   * A mock object of GameMap.
   * Used for testing before GameMap is fully implemented.
   */
  constructor() {
    this.tile = new Image();
    this.tile.src = '../../sites/game-client/test.png';
    window.testImg = this.tile;
  }

  getCellRenderInfo(layer, x, y) {
    return {
      image: this.tile,
    };
  }
}

export default GameMap;

export {GameMapMock};

/*
Sample format for the map:
{
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
}
TODO: Add more elaborate documentation on what cellSet is.
*/

/*
The map coordinate:
Be careful not to get confused with "canvas coordinate".
notation: (y, x)
unit: grid (or cell, in other words)

          ...

  (2,0)   (2,1)   (2,2)

  (1,0)   (1,1)   (1,2)   ...

  (0,0)   (0,1)   (0,2)

 */
