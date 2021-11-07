// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const KEYSTROKE_RATE = 30; // keystroke per second
const RELEASE_KEY_AFTER_MS = 1000;
// If we don't receive any key event after this interval, we manually release this key.
// For example, if somebody press a key and then alt-tab while the key is still held,
// keyup will not be sent by the browser.

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
    this.keydownEveryTickCallbacks = []; // each element is a {DOMElement, callback} object
    this.keydownOnceCallbacks = []; // each element is a {DOMElement, callback} object
    this.keyupCallbacks = []; // each element is a {DOMElement, callback} object

    // TODO: Better way of maintaining focused element.
    this.focusedElement = document.activeElement;

    // Maintain a list of pressed key for better user experience (player moving)
    this.pressedKeys = new Map(); // key: event.key, value: event.code
    document.addEventListener('keydown', (event) => {
      this.pressedKeys.set(event.key, {code: event.code, time: Date.now()});
      // TODO: Bug. The browser will continuouslly fire keydown event if key remains pressed.
      // Can be solved by recording how many times the callback is called.
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
    setInterval(() => {
      for (const [key, {code, time}] of this.pressedKeys.entries()) {
        if (Date.now() - time > RELEASE_KEY_AFTER_MS) {
          this.pressedKeys.delete(key);
        }
        for (const {DOMElement, callback} of this.keydownEveryTickCallbacks) {
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
        const mapCoord = this.mapRender.canvasToMapCoordinate(x, y);
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
