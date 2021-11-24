// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const KEYSTROKE_RATE = 30; // keystroke per second
const CANVAS_AUTO_FOCUS_MS = 200;

/**
 * Input manager deals with all user input.
 */
class InputManager {
  /**
   * Create a new input manager.
   * @constructor
   * @param {MapRenderer} mapRenderer - The MapRenderer object for retrieving the
   * canvas object for registering input events on it and mapping the
   * coordinates in the event to the map coordinate.
   */
  constructor(mapRenderer) {
    this.mapRenderer = mapRenderer;
    this.canvas = this.mapRenderer.getInputEventDOM();
    this.clickCallbacks = []; // each element is a {DOMElement, callback} object
    this.rightClickCallbacks = []; // each element is a {DOMElement, callback} object
    this.keydownEveryTickCallbacks = []; // each element is a {DOMElement, callback} object
    this.keydownOnceCallbacks = []; // each element is a {DOMElement, callback} object
    this.keyupCallbacks = []; // each element is a {DOMElement, callback} object

    // TODO: Better way of maintaining focused element.
    this.focusedElement = document.activeElement;

    // Maintain a list of pressed key for better user experience (player moving)
    this.pressedKeys = new Map(); // key: event.key, value: event.code
    document.addEventListener('keydown', (event) => {
      // We trigger `keydownOnceCallbacks` instead of `keydownEveryTickCallbacks`.
      // Since the browser will continuously fire keydown event if key remains pressed, we have to check if this is the first event.
      if (this.pressedKeys.has(event.key)) {
        return;
      }
      this.pressedKeys.set(event.key, {code: event.code});
      for (const {DOMElement, callback} of this.keydownOnceCallbacks) {
        if (this.focusedElement === DOMElement) {
          callback(event);
        }
      }
    });
    document.addEventListener('keyup', (event) => {
      if (this.pressedKeys.delete(event.key)) {
        for (const {DOMElement, callback} of this.keyupCallbacks) {
          if (this.focusedElement === DOMElement) {
            callback(event);
          }
        }
      }
    });
    window.addEventListener('blur', (event) => {
      const keys = new Map(this.pressedKeys); // shallow copy
      this.pressedKeys.clear(); // Clear in advance just in case if keyup callback uses `this.pressedKeys`.
      for (const [key, {code}] of keys.entries()) {
        for (const {callback} of this.keyupCallbacks) {
          callback(new KeyboardEvent('keyup', {key, code}));
        }
      }
    });
    setInterval(() => {
      for (const [key, {code}] of this.pressedKeys.entries()) {
        for (const {DOMElement, callback} of this.keydownEveryTickCallbacks) {
          if (this.focusedElement === DOMElement) {
            callback(new KeyboardEvent('keydown', {key, code}));
          }
        }
      }
    }, 1000 / KEYSTROKE_RATE);
    setInterval(() => {
      const active = document.activeElement;
      if (active === this.canvas) {
        return;
      }
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.contenteditable === 'true') {
        return;
      }
      this.focusedElement = this.canvas;
    }, CANVAS_AUTO_FOCUS_MS);

    document.addEventListener('click', (event) => {
      this.focusedElement = event.target;
      for (const {DOMElement, callback} of this.clickCallbacks) {
        if (event.target === DOMElement) {
          const rect = DOMElement.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          callback(x, y);
        }
      }
    });

    document.addEventListener('contextmenu', (event) => {
      for (const {DOMElement, callback} of this.rightClickCallbacks) {
        if (event.target === DOMElement) {
          const rect = DOMElement.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          callback(x, y);
        }
      }
    });

    this.gameClient = null;
    window.addEventListener('dataReady', (event) => {
      this.gameClient = event.detail.gameClient;
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
   * @param {Function} callback - Takes one argument: the clicked map coordinate.
   * Note that the map coordinate is not necessarily in integer.
   */
  registerCanvasOnClickMapCoord(callback) {
    this.registerCanvasOnClickPixel((canvasX, canvasY) => {
      const mapCoord = this.mapRenderer.canvasToMapCoordinate(canvasX, canvasY);
      callback(mapCoord);
    });
  }

  /**
   * Register a callback function on right-clicking a DOM element.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes two arguments: x and y coordinate
   * relative to the DOM element.
   */
  registerElementOnRightClick(DOMElement, callback) {
    this.clickCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on right-clicking the canvas of MapRenderer.
   * The unit of clicking position is pixel.
   * @param {Function} callback - Takes two arguments: x and y coordinate
   * in canvas coordinate.
   */
  registerCanvasOnRightClickPixel(callback) {
    this.registerElementOnRightClick(this.canvas, callback);
  }

  /**
   * Register a callback function on right-clicking the canvas of MapRenderer.
   * @param {Function} callback - Takes one argument: the clicked map coordinate.
   * Note that the map coordinate is not necessarily in integer.
   */
  registerCanvasOnRightClickMapCoord(callback) {
    this.registerCanvasOnRightClickPixel((canvasX, canvasY) => {
      const mapCoord = this.mapRenderer.canvasToMapCoordinate(canvasX, canvasY);
      callback(mapCoord);
    });
  }

  /**
   * Register a callback function when the mouse moves over the canvas of MapRenderer.
   * Note that this is used only for debugging so it uses the DOM element's
   * event directly and does not abstract away the MouseOver event.
   * @param {Function} callback - Takes one argument: the clicked map coordinate.
   * Note that the map coordinate is not necessarily in integer.
   */
  registerCanvasOnMouseMoveMapCoord(callback) {
    document.addEventListener('mousemove', (event) => {
      if (event.target === this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const mapCoord = this.mapRenderer.canvasToMapCoordinate(x, y);
        callback(mapCoord);
      }
    });
  }

  /**
   * Register a callback function on keydown.
   * The callback will be triggered every tick.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes an keydown event as argument.
   */
  registerKeydownEveryTick(DOMElement, callback) {
    this.keydownEveryTickCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on keydown.
   * The call back will be called when the key is pressed, not on every tick.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes an keydown event as argument.
   */
  registerKeydownOnce(DOMElement, callback) {
    this.keydownOnceCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on keyup.
   * The call back will be called when the key is released.
   * @param {Element} DOMElement
   * @param {Function} callback - Takes an keydown event as argument.
   */
  registerKeyup(DOMElement, callback) {
    this.keyupCallbacks.push({DOMElement, callback});
  }

  /**
   * Register a callback function on keydown if it is a player movement.
   * @param {Function} callback - Takes the movement direction as argument.
   */
  registerMapMove(callback) {
    this.registerKeydownEveryTick(this.canvas, (event) => {
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
