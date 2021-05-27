// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const mapCellSize = 32; // pixel

/**
 * MapRender renders the map onto the a canvas element.
 * The coordinate of canvas is shown at the end of the file.
 */
class MapRenderer {
  /**
   * Create a new MapRender.
   * @param {Canvas} canvas - The canvas to draw onto.
   * @param {GameMap} map - The map object to retrieve the map information.
   * @param {GameState} gameState - The game state.
   */
  constructor(canvas, map, gameState) {
    this.canvas = canvas;
    this.map = map;
    this.gameState = gameState;
    this.ctx = canvas.getContext('2d');

    /**
     * viewerPosition is the **map coordinate** of the center of canvas.
     * It is a real number, which enables smooth moving of the camera;
     */
    this.viewerPosition = {x: 10, y: 10}; // only used before GameState.getPlayerLocations() is fully implemented
    // this.viewerPosition = this.gameState.getPlayerLocations();
  }

  /**
   * Return map canvas
   * @return {Canvas} - The using canvas
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Set the position of the viewer, that is, the player that is playing right
   * now.
   * Calling this method only updates the parameters for calculating the
   * viewport location. (which part of the map is visible) It doesn't draw the
   * player.
   * @param {Number} x - The x coordinate.
   * @param {Number} y - The y coordinate.
   */
  setViewerPosition(x, y) {
    this.viewerPosition.x = x;
    this.viewerPosition.y = y;
  }

  /**
   * Converts canvas coordinate to map coordinate.
   * @param {Number} x - The x coordinate in the canvas.
   * @param {Number} y - The y coordinate in the canvas.
   * @return {Object} coordinate - The map coordinate. coordinate.x and
   * coordinate.y is available. Both x and y are floating numbers.
   */
  canvasToMapCoordinate(x, y) {
    const canvasCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2};
    return {
      x: this.viewerPosition.x + (x - canvasCenter.x) / mapCellSize + 0.5,
      y: this.viewerPosition.y + (y - canvasCenter.y) / mapCellSize + 0.5,
    };
  }

  /**
   * Converts map coordinate to canvas coordinate.
   * @param {Number} x - The x coordinate in the map.
   * @param {Number} y - The y coordinate in the map.
   * @return {Object} coordinate - The canvas coordinate. coordinate.x and
   * coordinate.y is available. Both x and y are integer.
   */
  mapToCanvasCoordinate(x, y) {
    const canvasCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2};
    return {
      x: Math.floor(canvasCenter.x + (x - this.viewerPosition.x - 0.5) * mapCellSize),
      y: Math.floor(canvasCenter.y + (y - this.viewerPosition.y - 0.5) * mapCellSize),
    };
  }

  /**
   * Draw everything onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  draw() {
    let ret = true;
    ret &&= this._drawGround();
    ret &&= this._drawPlayers();

    return ret;
  }

  /**
   * Draw layer "ground" onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  _drawGround() {
    const firstCellMapCoordFloat = this.canvasToMapCoordinate(0, 0);
    const firstCellMapCoordInt = {
      x: Math.floor(firstCellMapCoordFloat.x),
      y: Math.floor(firstCellMapCoordFloat.y),
    };
    const lastCellMapCoordFloat = this.canvasToMapCoordinate(this.canvas.width, this.canvas.height);
    const lastCellMapCoordInt = {
      x: Math.floor(lastCellMapCoordFloat.x),
      y: Math.floor(lastCellMapCoordFloat.y),
    };

    const ret = true;
    for (let mapY = firstCellMapCoordInt.y; mapY <= lastCellMapCoordInt.y; ++mapY) {
      for (let mapX = firstCellMapCoordInt.x; mapX <= lastCellMapCoordInt.x; ++mapX) {
        const renderInfo = this.map.getCellRenderInfo('ground', mapX, mapY);
        const canvasCoordinate = this.mapToCanvasCoordinate(mapX, mapY);
        this.ctx.drawImage(
            renderInfo.image,
            renderInfo.srcX,
            renderInfo.srcY,
            renderInfo.srcWidth,
            renderInfo.srcHeight,
            canvasCoordinate.x,
            canvasCoordinate.y,
            mapCellSize,
            mapCellSize,
        );
      }
    }
    return ret;
  }

  /**
   * Draw players onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  _drawPlayers() {
    // TODO: draw real players after GameState is fully implemented
    // for (let player of this.gameState.getPlayerLocations()) {
    //   this.ctx.drawImage(...);
    // }
    return true;
  }
}

export default MapRenderer;


/*
Below demonstrates the coordinate of the canvas:
Be careful not to get confused with "map coordinate".
format: (y, x)
unit: pixel

  (0,0)   (0,1)   (0,2)

  (1,0)   (1,1)   (1,2)   ...

  (2,0)   (2,1)   (2,2)

          ...

*/
