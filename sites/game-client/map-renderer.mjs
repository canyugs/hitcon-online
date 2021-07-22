// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

const mapCellSize = 32; // pixel
const fontStyle = '12px serif';

/**
 * MapRender renders the map onto the a canvas element.
 * The coordinate of canvas is shown below.
 * Be careful not to get confused with "map coordinate".
 * format: (y, x)
 * unit: pixel
 *
 *   (0,0)   (0,1)   (0,2)
 *
 *   (1,0)   (1,1)   (1,2)   ...
 *
 *   (2,0)   (2,1)   (2,2)
 *
 *           ...
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
    this.gameClient = null; // will be initialized in this.setGameClient()
    this.ctx = canvas.getContext('2d');

    /**
     * viewerPosition is the **map coordinate** of the center of canvas.
     * It is a real number, which enables smooth moving of the camera;
     */
    this.viewerPosition = new MapCoord('', NaN, NaN);
    this.viewportFollow = null; // will be initialized in this.initializeViewerPosition()
    this.gameState.registerPlayerLocationChange((loc) => {
      if (this.viewportFollow === loc.playerID) {
        // TODO: smoothly update viewer position
        this.setViewerPosition(loc.mapCoord, 0.5, 0.5);
      }
    });
  }

  /**
   * Set the GameClient of MapRenderer.
   * @param {GameClient} gameClient - The game state.
   */
  setGameClient(gameClient) {
    this.gameClient = gameClient;
  }

  /**
   * This function should be called after GameClient.onStartup()
   */
  initializeViewerPosition() {
    this.viewportFollow = this.gameClient.playerInfo.playerID;
    const coord = this.gameState.getPlayer(this.viewportFollow).mapCoord;
    this.setViewerPosition(coord, 0.5, 0.5);
  }

  /**
   * Return map canvas
   * @return {Canvas} - The using canvas
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Set the position of the viewer.
   * More precisely, the center of canvas will become (x, y).
   * If (x, y) is beyond the bound of the map, this function will clip the
   * coordinate to fit in the range of the map.
   * @param {MapCoord} coord - The map coordinate.
   * @param {Number} dx - Delta x to be added. Default is 0.
   * @param {Number} dy - Delta y to be added. Default is 0.
   */
  setViewerPosition(coord, dx, dy) {
    dx ??= 0;
    dy ??= 0;
    const {x, y} = coord;
    const mapSize = this.map.getMapSize(coord.mapName);
    const minX = (this.canvas.width / 2) / mapCellSize;
    const maxX = mapSize.width - minX;
    const minY = (this.canvas.height / 2) / mapCellSize;
    const maxY = mapSize.height - minY;
    this.viewerPosition.x = Math.min(Math.max(x + dx, minX), maxX);
    this.viewerPosition.y = Math.min(Math.max(y + dy, minY), maxY);
    this.viewerPosition.mapName = coord.mapName;
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
    const newX = this.viewerPosition.x + (x - canvasCenter.x) / mapCellSize;
    const newY = this.viewerPosition.y - (y - canvasCenter.y) / mapCellSize;
    return new MapCoord(this.viewerPosition.mapName, newX, newY);
  }

  /**
   * Converts map coordinate to canvas coordinate.
   * @param {MapCoord} coord - The map coordinate.
   * @return {Object} coordinate - The canvas coordinate. coordinate.x and
   * coordinate.y is available. Both x and y are integer.
   */
  mapToCanvasCoordinate(coord) {
    const {x, y} = coord;
    const canvasCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2};
    return {
      x: Math.floor(canvasCenter.x + (x - this.viewerPosition.x) * mapCellSize),
      y: Math.floor(canvasCenter.y - (y - this.viewerPosition.y) * mapCellSize),
    };
  }

  /**
   * Draw everything onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  draw() {
    if (this.viewportFollow === null) {
      // not initialized
      return false;
    }

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
    const firstCellMapCoordFloat = this.canvasToMapCoordinate(0, this.canvas.height);
    const firstCellMapCoordInt = {
      x: Math.floor(firstCellMapCoordFloat.x),
      y: Math.floor(firstCellMapCoordFloat.y),
    };
    const lastCellMapCoordFloat = this.canvasToMapCoordinate(this.canvas.width, 0);
    const lastCellMapCoordInt = {
      x: Math.floor(lastCellMapCoordFloat.x),
      y: Math.floor(lastCellMapCoordFloat.y),
    };
    const mapSize = this.map.getMapSize(this.viewerPosition.mapName);

    const ret = true;
    for (let mapY = firstCellMapCoordInt.y; mapY <= lastCellMapCoordInt.y; ++mapY) {
      for (let mapX = firstCellMapCoordInt.x; mapX <= lastCellMapCoordInt.x; ++mapX) {
        if (mapX < 0 || mapX >= mapSize.width || mapY < 0 || mapY >= mapSize.height) continue;
        const coord = new MapCoord(this.viewerPosition.mapName, mapX, mapY);
        const renderInfo = this.map.getCellRenderInfo(coord, 'ground');
        const canvasCoordinate = this.mapToCanvasCoordinate(coord);
        this.ctx.drawImage(
            renderInfo.image,
            renderInfo.srcX,
            renderInfo.srcY,
            renderInfo.srcWidth,
            renderInfo.srcHeight,
            canvasCoordinate.x,
            canvasCoordinate.y - renderInfo.srcHeight,
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
    const players = this.gameState.getPlayers();
    for (const {mapCoord, displayChar, facing} of Object.values(players)) {
      const canvasCoordinate = this.mapToCanvasCoordinate(mapCoord);
      // check if this player is out of viewport
      if (canvasCoordinate.x < -mapCellSize ||
          canvasCoordinate.x >= this.canvas.width ||
          canvasCoordinate.y < -mapCellSize ||
          canvasCoordinate.y >= this.canvas.height) {
        continue;
      }
      const renderInfo = this.map.graphicAsset.getCharacter(displayChar,
          facing);
      this.ctx.drawImage(
          renderInfo.image,
          renderInfo.srcX,
          renderInfo.srcY,
          renderInfo.srcWidth,
          renderInfo.srcHeight,
          canvasCoordinate.x,
          canvasCoordinate.y - renderInfo.srcHeight,
          mapCellSize,
          mapCellSize,
      );
    }

    // draw displayName
    this.ctx.save();
    this.ctx.font = fontStyle;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    for (const {mapCoord, displayName} of Object.values(players)) {
      const {x, y} = mapCoord;
      const canvasCoordinate = this.mapToCanvasCoordinate(new MapCoord(this.viewerPosition.mapName, x + 0.5, y + 1));
      // there is no need for out-of-canvas check
      this.ctx.fillText(displayName, canvasCoordinate.x, canvasCoordinate.y);
    }
    this.ctx.restore();
    return true;
  }
}

export default MapRenderer;
