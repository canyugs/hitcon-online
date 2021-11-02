// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

const MAP_CELL_SIZE = 32; // pixel
const fontStyle = '12px serif';

const LAYER_PLAYER_IMAGE = {zIndex: 10, layerName: 'playerImage'};
const LAYER_PLAYER_NAME = {zIndex: 15, layerName: 'playerName'};
const LAYER_OBJECT = {zIndex: 1, layerName: 'object'};

const OUTER_SPACE_TILE = ['ground', 'H']; // the parameters of GraphicAsset.getTile()

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
   * @param {Canvas} foregroundCanvas - The canvas to draw onto.
   * @param {Canvas} backgroundCanvas - The background canvas.
   * @param {Canvas} outOfBoundCanvas - The canvas to draw out-of-bound tile.
   * @param {GameMap} map - The map object to retrieve the map information.
   * @param {GameState} gameState - The game state.
   */
  constructor(foregroundCanvas, backgroundCanvas, outOfBoundCanvas, map, gameState) {
    this.canvas = foregroundCanvas;
    this.backgroundCanvas = backgroundCanvas;
    this.outOfBoundCanvas = outOfBoundCanvas;
    this.map = map;
    this.gameState = gameState;
    this.gameClient = null; // will be initialized in this.setGameClient()
    this.ctx = foregroundCanvas.getContext('2d');
    this.backgroundCtx = backgroundCanvas.getContext('2d');
    this.outOfBoundCtx = outOfBoundCanvas.getContext('2d');

    /**
     * viewerPosition is the **map coordinate** of the center of canvas.
     * It is a real number, which enables smooth moving of the camera;
     */
    this.viewerPosition = new MapCoord('', NaN, NaN);
    this.viewportFollow = null; // will be initialized in this.initializeViewerPosition()

    window.addEventListener('dataReady', this.initializeViewerPosition.bind(this));

    /**
     * @member {Array} customizedLayers - Customized layer that needs to be rendered.
     * Refer to `this.registerCustomizedLayerToDraw()` for more details.
     */
    this.customizedLayers = [];
    /**
     * @member {Array} customizedBackgroundLayers - Customized layer that needs to be rendered to background canvas.
     * Refer to `this.registerCustomizedLayerToDrawBackground()` for more details.
     */
    this.customizedBackgroundLayers = [];

    // 'playerImage' and 'playerName' are layers defined and used only by MapRenderer
    this.registerCustomizedLayerToDraw(LAYER_PLAYER_IMAGE.zIndex, LAYER_PLAYER_IMAGE.layerName, '_drawManyCharacterImage', this.gameState.players);
    this.registerCustomizedLayerToDraw(LAYER_PLAYER_NAME.zIndex, LAYER_PLAYER_NAME.layerName, '_drawManyCharacterName', this.gameState.players);

    // other background layers
    this.registerCustomizedLayerToDrawBackground(-100000, 'ground');
    this.registerCustomizedLayerToDrawBackground(LAYER_OBJECT.zIndex, LAYER_OBJECT.layerName);
  }

  /**
   * Set the GameClient of MapRenderer.
   * @param {GameClient} gameClient - The game state.
   */
  setGameClient(gameClient) {
    this.gameClient = gameClient;
  }

  /**
   * Disable rendering for testing.
   * Note that there's no way to turn it back on without refresh.
   */
  disableRenderForTesting() {
    const noop = ()=>{};
    this.ctx.drawImage = noop;
    this.ctx.fillText = noop;
    this.ctx.save = noop;
    this.ctx.restore = noop;
    // Note: The last one is a bit too extreme, if testing fails for any reason
    // try removing the next line.
    this.draw = noop;
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
    this.viewerPosition.x = coord.x + dx;
    this.viewerPosition.y = coord.y + dy;
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
    const newX = this.viewerPosition.x + (x - canvasCenter.x) / MAP_CELL_SIZE;
    const newY = this.viewerPosition.y - (y - canvasCenter.y) / MAP_CELL_SIZE;
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
      x: Math.floor(canvasCenter.x + (x - this.viewerPosition.x) * MAP_CELL_SIZE),
      y: Math.floor(canvasCenter.y - (y - this.viewerPosition.y) * MAP_CELL_SIZE),
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
   * Similar to registerCustomizedLayerToDraw but draws to background canvas.
   * @param {Number} zIndex - Should be an integer. Refer to the definition of 'z-index' in CSS.
   * @param {String} layerName - The layer to be drawn.
   * @param {String} renderFunction - Optional. The rendering function used to render this layer.
   * @param {any} renderArgs - Optional. The optional argument if renderFunction requires one.
   */
  registerCustomizedLayerToDrawBackground(zIndex, layerName, renderFunction, renderArgs) {
    // TODO: use binary search and Array.prototype.splice() to improve performance
    this.customizedBackgroundLayers.push([zIndex, layerName, renderFunction, renderArgs]);
    this.customizedBackgroundLayers.sort((a, b) => a[0] - b[0]);
  }

  /**
   * Render the out-of-bound tiles.
   */
  generateOutOfBoundBackground() {
    const newWidth = this.canvas.width + MAP_CELL_SIZE;
    const newHeight = this.canvas.height + MAP_CELL_SIZE;
    if (this.outOfBoundCanvas.width === newWidth && this.outOfBoundCanvas.height === newHeight) {
      return;
    }

    // update canvas size
    // note that the size should be larger to provide the margin of translation
    this.outOfBoundCanvas.width = newWidth;
    this.outOfBoundCanvas.height = newHeight;

    // draw
    const outerSpaceRenderInfo = this.map.graphicAsset.getTile(...OUTER_SPACE_TILE);
    for (let y = 0; y < this.outOfBoundCanvas.height; y += MAP_CELL_SIZE) {
      for (let x = 0; x < this.outOfBoundCanvas.width; x += MAP_CELL_SIZE) {
        this.outOfBoundCtx.drawImage(
            outerSpaceRenderInfo.image,
            outerSpaceRenderInfo.srcX,
            outerSpaceRenderInfo.srcY,
            outerSpaceRenderInfo.srcWidth,
            outerSpaceRenderInfo.srcHeight,
            x,
            y,
            MAP_CELL_SIZE,
            MAP_CELL_SIZE,
        );
      }
    }
  }

  /**
   * Render the background map to background canvas.
   * This function is not reentrant (guarded by the if-else at the entry of the function).
   */
  async generateBackground() {
    // There should be at most one thread doing this job in client's browser.
    if (this._generateBackgroundLock !== undefined) {
      return;
    }
    this._generateBackgroundLock = true;

    // If the current map is not changed, no need to rerender.
    const mapName = this.viewerPosition.mapName;
    if (this._currentBackgroundMapName === mapName) {
      this._generateBackgroundLock = undefined;
      return;
    }

    // set canvas size
    const mapSize = this.map.getMapSize(mapName);
    this.backgroundCanvas.width = mapSize.width * MAP_CELL_SIZE;
    this.backgroundCanvas.height = mapSize.height * MAP_CELL_SIZE;

    // draw background
    for (const [, layerName, renderFunction, renderArgs] of this.customizedBackgroundLayers) {
      if (renderFunction === '_drawWatermark') {
        this._drawWatermark(renderArgs);
      } else {
        // draw layer
        for (let mapY = 0; mapY < mapSize.height; ++mapY) {
          for (let mapX = 0; mapX < mapSize.width; ++mapX) {
            const renderInfo = this.map.getCellRenderInfo(new MapCoord(mapName, mapX, mapY), layerName);
            if (renderInfo === null) continue;

            const canvasX = mapX * MAP_CELL_SIZE;
            const canvasY = this.backgroundCanvas.height - renderInfo.srcHeight - mapY * MAP_CELL_SIZE;
            this.backgroundCtx.drawImage(
                renderInfo.image,
                renderInfo.srcX,
                renderInfo.srcY,
                renderInfo.srcWidth,
                renderInfo.srcHeight,
                canvasX,
                canvasY,
                MAP_CELL_SIZE,
                MAP_CELL_SIZE,
            );
          }

          // avoid blocking the event loop
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        }
      }
    }

    this._currentBackgroundMapName = mapName;
    this._generateBackgroundLock = undefined;
  }

  /**
   * Use CSS transform to improve performance.
   * reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#scaling_canvas_using_css_transforms
   */
  translateOutOfBoundBackground() {
    if (this._previousViewerPosition === undefined) {
      this._previousViewerPosition = new MapCoord('', NaN, NaN);
    }

    if (this._previousViewerPosition.equalsTo(this.viewerPosition)) {
      return;
    }

    function decimalPartWithin01(num) {
      if (num >= 0) {
        return num % 1;
      }
      return (num + Math.floor(-num) + 1) % 1;
    }

    // Note that the size of this canvas is slightly larger than it should be.
    // Therefore, translation within 1 MAP_CELL_SIZE should be safe.
    const {x: mapX, y: mapY} = this.canvasToMapCoordinate(0, 0);
    const translateX = -Math.floor(decimalPartWithin01(mapX) * MAP_CELL_SIZE);
    const translateY = -Math.floor(decimalPartWithin01(this.outOfBoundCanvas.height - mapY) * MAP_CELL_SIZE);
    this.outOfBoundCanvas.style.transform = `translate(${translateX}px, ${translateY}px)`;

    this._previousViewerPosition = MapCoord.fromObject(this.viewerPosition);
  }

  /**
   * Use CSS transform to improve performance.
   * reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#scaling_canvas_using_css_transforms
   */
  translateBackground() {
    if (this._translateBackgroundPreviousX === undefined) {
      this._translateBackgroundPreviousX = Infinity;
      this._translateBackgroundPreviousY = Infinity;
    }

    const {x: mapX, y: mapY} = this.canvasToMapCoordinate(0, 0);
    if (this._translateBackgroundPreviousX === mapX && this._translateBackgroundPreviousY === mapY) {
      return;
    }

    const translateX = -Math.floor(mapX * MAP_CELL_SIZE);
    const translateY = -Math.floor(this.backgroundCanvas.height - (mapY * MAP_CELL_SIZE));
    this.backgroundCanvas.style.transform = `translate(${translateX}px, ${translateY}px)`;

    this._translateBackgroundPreviousX = mapX;
    this._translateBackgroundPreviousY = mapY;
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
    this.generateOutOfBoundBackground();
    this.translateOutOfBoundBackground();
    this.generateBackground();
    this.translateBackground();

    // draw foreground
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
        if (mapX < 0 || mapX >= mapSize.width || mapY < 0 || mapY >= mapSize.height) {
          continue;
        }
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
        MAP_CELL_SIZE,
        MAP_CELL_SIZE,
    );
  }

  /**
   * Draw the image of one player or NPC onto the canvas.
   * @param {Object} player - The players to be drawn. `player.getDrawInfo()`
   * would be called to get the information for drawing.
   */
  _drawOneCharacterImage(player) {
    const {mapCoord, displayChar, facing, ghostMode} = player.getDrawInfo();
    const canvasCoordinate = this.mapToCanvasCoordinate(mapCoord);
    const topLeftCanvasCoord = {x: canvasCoordinate.x, y: canvasCoordinate.y - MAP_CELL_SIZE};
    // check if this player is out of viewport
    if (topLeftCanvasCoord.x < -MAP_CELL_SIZE ||
        topLeftCanvasCoord.x >= this.canvas.width ||
        topLeftCanvasCoord.y < -MAP_CELL_SIZE ||
        topLeftCanvasCoord.y >= this.canvas.height) {
      return;
    }
    const renderInfo = this.map.graphicAsset.getCharacter(displayChar,
        facing);
    const oldOpacity = this.ctx.globalAlpha;
    if (ghostMode) {
      this.ctx.globalAlpha = 0.4;
    }
    this.ctx.drawImage(
        renderInfo.image,
        renderInfo.srcX,
        renderInfo.srcY,
        renderInfo.srcWidth,
        renderInfo.srcHeight,
        topLeftCanvasCoord.x,
        topLeftCanvasCoord.y,
        MAP_CELL_SIZE,
        MAP_CELL_SIZE,
    );
    this.ctx.globalAlpha = oldOpacity;
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
    for (const watermark of watermarks) {
      for (const mapCoord of watermark.mapCoords) {
        // check if watermark is in current map
        if (mapCoord.mapName !== this.viewerPosition.mapName) {
          continue;
        }

        const topLeftCanvasCoord = {
          x: mapCoord.x * MAP_CELL_SIZE,
          y: this.backgroundCanvas.height - mapCoord.y * MAP_CELL_SIZE,
        };

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

        // if dWidth, dHeight undefined, then use sWidth, sHeight instead
        const dWidth = watermark.dWidth ?? watermark.sWidth;
        const dHeight = watermark.dHeight ?? watermark.sHeight;

        this.backgroundCtx.drawImage(
            watermark.image,
            watermark.srcX,
            watermark.srcY,
            watermark.sWidth,
            watermark.sHeight,
            topLeftCanvasCoord.x,
            topLeftCanvasCoord.y,
            dWidth,
            dHeight,
        );
      }
    }
  }
}

export default MapRenderer;

export {
  MapRenderer,
  MAP_CELL_SIZE,
};
