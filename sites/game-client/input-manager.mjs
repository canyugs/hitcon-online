// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const KEYSTROKE_RATE = 10; // keystroke per second

/**
 * Input manager deals with all user input.
 */
class InputManager {
  /**
   * Create a new input manager.
   * @constructor
   * @param {MapRender} mapRender - The MapRender object for retrieving the
   * canvas object for registering input events on it and mapping the
   * coordinates in the event to the map coordinate.
   */
  constructor(mapRender) {
    this.mapRender = mapRender;
    this.canvas = this.mapRender.getCanvas();
    this.clickCallbacks = []; // each element is a {DOMElement, callback} object
    this.keydownCallbacks = []; // each element is a {DOMElement, callback} object

    // TODO: Better way of maintaining focused element.
    this.focusedElement = document.activeElement;

    // TODO: Maintain a list of pressed key for better user experience (player moving)
    this.pressedKeys = new Map(); // key: event.key, value: event.code
    document.addEventListener('keydown', (event) => {
      this.pressedKeys.set(event.key, event.code);
    });
    document.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.key);
    });
    setInterval(() => {
      for (const {DOMElement, callback} of this.keydownCallbacks) {
        // TODO: Send event to the focused element only.
        for (const [key, code] of this.pressedKeys.entries()) {
          if (this.focusedElement === DOMElement) {
            callback(new KeyboardEvent('keydown', {key, code}));
          }
        }
      }
    }, 1000 / KEYSTROKE_RATE);

    document.addEventListener('click', (event) => {
      this.focusedElement = event.target;
      for (const {DOMElement, callback} of this.clickCallbacks) {
        if (event.target === DOMElement) {
          const rect = DOMElement.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          callback(x, y);
          // TODO: preventDefault stopPropagation correctly
        }
      }
    });

    this.gameClient = null;
    window.addEventListener('gameStart', (event) => {
      this.gameClient = event.detail.gameClient;
      this.registerMapMove((direction) => {
        this.gameClient.onDirection(direction);
      });
    });
  }

  /**
   * Register a callback function on clicking a DOM element.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes two arguments: x and y coordinate
   * relative to the DOM element.
   */
  registerElementOnClick(DOMElement, callback) {
    this.clickCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on clicking the canvas of MapRenderer.
   * The unit of clicking position is pixel.
   * @param {Function} callback - Takes two arguments: x and y coordinate
   * in canvas coordinate.
   */
  registerCanvasOnClickPixel(callback) {
    this.registerElementOnClick(this.canvas, callback);
  }

  /**
   * Register a callback function on clicking the canvas of MapRenderer.
   * The unit of clicking position is pixel.
   * @param {Function} callback - Takes one argument: the clicked map coordinate.
   * Note that the map coordinate is not necessarily in integer.
   */
  registerCanvasOnClickMapCoord(callback) {
    this.registerCanvasOnClickPixel((canvasX, canvasY) => {
      const mapCoord = this.mapRender.canvasToMapCoordinate(canvasX, canvasY);
      callback(mapCoord);
    });
  }

  /**
   * Register a callback function on keydown.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes an keydown event as argument.
   */
  registerKeydown(DOMElement, callback) {
    this.keydownCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on keydown if it is a player movement.
   * @param {Function} callback - Takes the movement direction as argument.
   */
  registerMapMove(callback) {
    this.registerKeydown(this.canvas, (event) => {
      let direction;
      switch (event.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          direction = 'U';
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          direction = 'D';
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          direction = 'L';
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          direction = 'R';
          break;
        default:
          direction = undefined;
      }
      if (direction) {
        callback(direction);
      }
    });
  }
}

export default InputManager;
