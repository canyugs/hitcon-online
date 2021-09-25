// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

const mapCellSize = 32; // pixel
const fontStyle = '12px serif';

const LAYER_PLAYER_IMAGE = {zIndex: 10, layerName: 'playerImage'};
const LAYER_PLAYER_NAME = {zIndex: 15, layerName: 'playerName'};

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

    window.addEventListener('gameStart', this.initializeViewerPosition.bind(this));

    /**
     * @member {Array} customizedLayers - Customized layer that needs to be rendered.
     * Refer to `this.registerCustomizedLayerToDraw()` for more details.
     */
    this.customizedLayers = [];

    // 'playerImage' and 'playerName' are layers defined and used only by MapRenderer
    this.registerCustomizedLayerToDraw(LAYER_PLAYER_IMAGE.zIndex, LAYER_PLAYER_IMAGE.layerName, '_drawManyCharacterImage', this.gameState.players);
    this.registerCustomizedLayerToDraw(LAYER_PLAYER_NAME.zIndex, LAYER_PLAYER_NAME.layerName, '_drawManyCharacterName', this.gameState.players);
  }

  /**
   * Set the GameClient of MapRenderer.
   * @param {GameClient} gameClient - The game state.
   */
  setGameClient(gameClient) {
    this.gameClient = gameClient;
  }

  /**
   * This function is a listener of "gameStart" event.
   */
  initializeViewerPosition() {
    this.viewportFollow = this.gameClient.playerInfo.playerID;
    const coord = this.gameState.getPlayer(this.viewportFollow).mapCoord;
    this.setViewerPosition(coord, 0.5, 0.5);
  }

  /**
   * Update viewer position.
   * Since getDrawInfo() handles movement smoothly, this function will update viewer position smoothly.
   */
  updateViewerPosition() {
    this.viewportFollow = this.gameClient.playerInfo.playerID;
    const coord = this.gameState.getPlayer(this.viewportFollow).getDrawInfo().mapCoord;
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
   * Determine whether the target is inside the viewport.
   * @param {object} topleftCoord - The target's left-top coordinate (x, y) relative to canvas.
   * @param {object} bottomrightCoord - The target's right-bottom coordinate (x, y) relative to canvas.
   * @return {bool} isInside - return true if the target is inside the viewport.
   */
  insideViewport(topleftCoord, bottomrightCoord) {
    const {x: x1, y: y1} = topleftCoord;
    const {x: x2, y: y2} = bottomrightCoord;
    const {width: w, height: h} = this.canvas;

    // check if the target's position is in the player's viewport
    if ((x1 >= 0 && y1 >= 0 && x1 <= w && y1 <= h) ||
        (x2 >= 0 && y2 >= 0 && x2 <= w && y2 <= h) ||
        (x1 >= 0 && y2 >= 0 && x1 <= w && y2 <= h) ||
        (x2 >= 0 && y1 >= 0 && x2 <= w && y1 <= h)) {
      return true;
    }
    return false;
  }

  /**
   * Register a customized layer for drawing. Commonly used by extension.
   * Be careful with `renderArgs`. Due to the pass-by-reference of JavaScript, you may want to
   * pass a container of your render arguments as follows:
   * ```javascript
   * class MyExtension {
   *   constructor() {
   *     Object.defineProperty(this, 'renderArgs', {value: {}});
   *     registerCustomizedLayerToDraw(0, 'layer', 'renderFunc', this.renderArgs);
   *   }
   *   someMethod() {
   *     // this.renderArgs = {a:1, b:2}; // Reassigning is disabled. This will cause error.
   *     this.renderArgs.a = 1; // do this instead
   *     this.renderArgs.b = 2; // do this instead
   *   }
   * }
   * ```
   * Reassigning causes a dangling object, which means the registered `renderArgs` does not point
   * to the reassigned `renderArgs`.
   * Using the above code snippet, you can ensure that `'renderFunc'` always access the identical
   * object in your extension, and no need to worry about accidentally reassign the `renderArgs`.
   * Consider using `Object.freeze()` if you never need any modification on `renderArgs`.
   * @param {Number} zIndex - Should be an integer. Refer to the definition of 'z-index' in CSS.
   * @param {String} layerName - The layer to be drawn.
   * @param {String} renderFunction - Optional. The rendering function used to render this layer.
   * @param {any} renderArgs - Optional. The optional argument if renderFunction requires one.
   */
  registerCustomizedLayerToDraw(zIndex, layerName, renderFunction, renderArgs) {
    // TODO: use binary search and Array.prototype.splice() to improve performance
    this.customizedLayers.push([zIndex, layerName, renderFunction, renderArgs]);
    this.customizedLayers.sort((a, b) => a[0] - b[0]);
  }

  /**
   * Draw everything onto the canvas.
   */
  draw() {
    // if not initialized
    if (this.viewportFollow === null) return;

    // update viewer position
    this.updateViewerPosition();

    // draw background
    this._drawEveryCellWrapper(this._drawLayer.bind(this, 'ground'));

    // draw foreground
    for (const [, layerName, renderFunction, renderArgs] of this.customizedLayers) {
      switch (renderFunction) {
        case '_drawManyCharacterImage':
          this._drawManyCharacterImage(renderArgs);
          break;

        case '_drawManyCharacterName':
          this._drawManyCharacterName(renderArgs);
          break;

        case '_drawOneCharacterImage':
          this._drawOneCharacterImage(renderArgs);
          break;

        case '_drawOneCharacterName':
          this._drawOneCharacterName(renderArgs);
          break;

        case '_drawWaterMark':
          this._drawWaterMark(renderArgs);
          break;

        default:
          this._drawEveryCellWrapper(this._drawLayer.bind(this, layerName));
      }
    }
  }

  /**
   * This function is the argument of _drawEveryCellWrapper(fn).
   * @callback drawOneCellFunction
   * @param {MapCoord} mapCoord - The map coordinate to be drawn.
   * @return {Boolean} success - Return true if successful.
   */
  /**
   * This is a wrapper function that calls fn to draw every cell on screen.
   * @param {drawOneCellFunction} fn - The function that draws a given cell.
   */
  _drawEveryCellWrapper(fn) {
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

    for (let mapY = firstCellMapCoordInt.y; mapY <= lastCellMapCoordInt.y; ++mapY) {
      for (let mapX = firstCellMapCoordInt.x; mapX <= lastCellMapCoordInt.x; ++mapX) {
        if (mapX < 0 || mapX >= mapSize.width || mapY < 0 || mapY >= mapSize.height) continue;
        const coord = new MapCoord(this.viewerPosition.mapName, mapX, mapY);
        fn(coord);
      }
    }
  }

  /**
   * Draw layer "ground" of mapCoord onto the canvas.
   * @param {String} layerName - The layer to be drawn.
   * @param {MapCoord} mapCoord - The map coordinate to be drawn.
   */
  _drawLayer(layerName, mapCoord) {
    const renderInfo = this.map.getCellRenderInfo(mapCoord, layerName);
    if (renderInfo === null) return;

    const canvasCoordinate = this.mapToCanvasCoordinate(mapCoord);
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

  /**
   * Draw the image of one player or NPC onto the canvas.
   * @param {Object} player - The players to be drawn. `player.getDrawInfo()`
   * would be called to get the information for drawing.
   */
  _drawOneCharacterImage(player) {
    const {mapCoord, displayChar, facing} = player.getDrawInfo();
    const canvasCoordinate = this.mapToCanvasCoordinate(mapCoord);
    const topLeftCanvasCoord = {x: canvasCoordinate.x, y: canvasCoordinate.y - mapCellSize};
    // check if this player is out of viewport
    if (topLeftCanvasCoord.x < -mapCellSize ||
        topLeftCanvasCoord.x >= this.canvas.width ||
        topLeftCanvasCoord.y < -mapCellSize ||
        topLeftCanvasCoord.y >= this.canvas.height) {
      return;
    }
    const renderInfo = this.map.graphicAsset.getCharacter(displayChar,
        facing);
    this.ctx.drawImage(
        renderInfo.image,
        renderInfo.srcX,
        renderInfo.srcY,
        renderInfo.srcWidth,
        renderInfo.srcHeight,
        topLeftCanvasCoord.x,
        topLeftCanvasCoord.y,
        mapCellSize,
        mapCellSize,
    );
  }

  /**
   * Draw the name of one player or NPC onto the canvas.
   * @param {Object} player - The players to be drawn. `player.getDrawInfo()`
   * would be called to get the information for drawing.
   */
  _drawOneCharacterName(player) {
    // TODO: Remember whether the previous call of `this.draw()` renders text.
    // If so, no need to save and restore the context. May improve performance.
    this.ctx.save();
    this.ctx.font = fontStyle;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';

    const {mapCoord, displayName} = player.getDrawInfo();
    const {x, y} = mapCoord;
    const canvasCoordinate = this.mapToCanvasCoordinate(new MapCoord(this.viewerPosition.mapName, x + 0.5, y + 1));
    // there is no need for out-of-canvas check
    this.ctx.fillText(displayName, canvasCoordinate.x, canvasCoordinate.y);

    this.ctx.restore();
  }

  /**
   * Draw the images of players or NPCs onto the canvas.
   * @param {Map} players - The players to be drawn. For every `player` in `players`,
   * `player.getDrawInfo()` would be called to get the information for drawing.
   */
  _drawManyCharacterImage(players) {
    for (const player of players.values()) {
      this._drawOneCharacterImage(player);
    }
  }

  /**
   * Draw the names of players or NPCs onto the canvas.
   * @param {Map} players - The players to be drawn. For every `player` in `players`,
   * `player.getDrawInfo()` would be called to get the information for drawing.
   */
  _drawManyCharacterName(players) {
    for (const player of players.values()) {
      this._drawOneCharacterName(player);
    }
  }

  /**
   * Draw objects as watermarks onto the canvas
   * @param {watermarks} players - The watermarks to be drawn. Refer to extensions/MapWatermark for format.
   */
  _drawWatermark(watermarks) {
    watermarks.forEach((watermark) => {
      watermark.mapCoords.forEach((mapCoord) => {
        // Check the player is in the same map
        if (this.gameClient.playerInfo.mapCoord.mapName !== mapCoord.mapName) {
          return;
        }

        const canvasCoordinate = this.mapToCanvasCoordinate(mapCoord);
        const topLeftCanvasCoord = Object.assign({}, canvasCoordinate);

        // adjust horizontal
        switch (watermark.position) {
          case 'topleft': case 'midleft': case 'bottomleft':
            break;
          case 'midtop': case 'center': case 'midbottom':
            topLeftCanvasCoord.x -= watermark.dWidth / 2;
            break;
          case 'topright': case 'midright': case 'bottomright':
            topLeftCanvasCoord.x -= watermark.dWidth;
            break;
        }
        // adjust vertical
        switch (watermark.position) {
          case 'topleft': case 'midtop': case 'topright':
            break;
          case 'midleft': case 'center': case 'midright':
            topLeftCanvasCoord.y -= watermark.dHeight / 2;
            break;
          case 'bottomleft': case 'midbottom': case 'bottomright':
            topLeftCanvasCoord.y -= watermark.dHeight;
            break;
        }

        // Check the watermark is inside the player's viewport
        const rightBottomCanvasCoord = {x: topLeftCanvasCoord.x + watermark.dWidth, y: topLeftCanvasCoord.y + watermark.dHeight};
        if (!this.insideViewport(topLeftCanvasCoord, rightBottomCanvasCoord)) {
          return;
        }

        // if dWidth, dHeight undefined, then use sWidth, sHeight instead
        if (!watermark.dWidth) {
          watermark.dWidth = watermark.sWidth;
        }
        if (!watermark.dHeight) {
          watermark.dHeight = watermark.sHeight;
        }

        this.ctx.drawImage(
            watermark.image,
            watermark.srcX,
            watermark.srcY,
            watermark.sWidth,
            watermark.sHeight,
            topLeftCanvasCoord.x,
            topLeftCanvasCoord.y,
            watermark.dWidth,
            watermark.dHeight,
        );
      });
    });
  }
}

export default MapRenderer;
