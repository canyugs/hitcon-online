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
    this.myasset = asset;
    this.mymap = map;
    if (!this.mymap) {
      throw 'No map json supplied with new GameMap()';
    }
  }

  /**
   * Return the GraphicAsset that is in use with this class.
   * @return {GraphicAsset} asset
   */
  graphicAsset() {
    return this.myasset;
  }

  /**
   * Get the size of the entire map.
   * @return {Object} size - size.height and size.width are available.
   */
  getMapSize() {
    return {width: this.mymap.width, height: this.mymap.height};
  }

  /**
   * Get the raw cell content at the coordinate.
   * @param {String} layer - The raw layer designation.
   * @param {Number} x - The X coordinate, must be integer.
   * @param {Number} y - The Y coordinate, must be integer.
   * @return {String} cell - The raw content of the cell. '' if any error.
   */
  getCell(layer, x, y) {
    if (x < 0 || x >= this.mymap.width || y < 0 || y >= this.mymap.height) throw 'map index out of bound';
    const cell = this.mymap[layer][y*this.mymap.width + x];
    return cell;
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
    return this.myasset.getTile(layer, tile);
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
}
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
