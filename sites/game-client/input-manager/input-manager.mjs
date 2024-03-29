// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const KEYSTROKE_RATE = 30; // keystroke per second
const CANVAS_AUTO_FOCUS_MS = 200;

const JOYSTICK_CONTAINER_ID = 'joystick-container';
const JOYSTICK_CONTROL_POINT_CONTAINER_ID = 'joystick-control-point-container';
const JOYSTICK_CONTROL_POINT_ID = 'joystick-control-point';
const JOYSTICK_GHOST_MODE_BUTTON_ID = 'joystick-ghost-mode-button';
const JOYSTICK_GAME_BUTTON_ID = 'joystick-game-button';

const JOYSTICK_EFFECTIVE_RADIUS = 0.3;

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
   * @param {Boolean} enableJoyStick
   */
  constructor(mapRenderer, enableJoyStick) {
    this.mapRenderer = mapRenderer;
    this.canvas = this.mapRenderer.getInputEventDOM();
    this.clickCallbacks = []; // each element is a {DOMElement, callback} object
    this.rightClickCallbacks = []; // each element is a {DOMElement, callback} object
    this.joyStickEveryTickCallbacks = []; // each element is a callback object
    this.keydownEveryTickCallbacks = []; // each element is a {DOMElement, callback} object
    this.keydownOnceCallbacks = []; // each element is a {DOMElement, callback} object
    this.keyupCallbacks = []; // each element is a {DOMElement, callback} object
    this.hasStarted = false; // if the game has started
    this.joystick = new JoyStick(
        this,
        document.getElementById(JOYSTICK_CONTAINER_ID),
        document.getElementById(JOYSTICK_CONTROL_POINT_CONTAINER_ID),
        document.getElementById(JOYSTICK_CONTROL_POINT_ID),
        document.getElementById(JOYSTICK_GHOST_MODE_BUTTON_ID),
        document.getElementById(JOYSTICK_GAME_BUTTON_ID),
    );

    if (enableJoyStick !== true) {
      this.joystick.disable();
    }

    // TODO: Better way of maintaining focused element.
    this.focusedElement = document.activeElement;

    // Maintain a list of pressed key for better user experience (player moving)
    this.pressedKeys = new Map(); // key: event.key, value: event.code

    this.gameClient = null;
    // Input manager only have effect after the game starts.
    // Therefore, the event listeners are registered after 'dataReady' event.
    window.addEventListener('dataReady', (event) => {
      this.gameClient = event.detail.gameClient;

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

      // automatic 'keyup'
      window.addEventListener('blur', (event) => {
        const keys = new Map(this.pressedKeys); // shallow copy
        this.pressedKeys.clear(); // Clear in advance just in case if keyup callback uses `this.pressedKeys`.
        for (const [key, {code}] of keys.entries()) {
          for (const {callback} of this.keyupCallbacks) {
            callback(new KeyboardEvent('keyup', {key, code}));
          }
        }
      });

      // automatic 'keydown'
      setInterval(() => {
        for (const [key, {code}] of this.pressedKeys.entries()) {
          for (const {DOMElement, callback} of this.keydownEveryTickCallbacks) {
            if (this.focusedElement === DOMElement) {
              callback(new KeyboardEvent('keydown', {key, code}));
            }
          }
        }
        for (const callback of this.joyStickEveryTickCallbacks) {
          callback(this.joystick);
        }
      }, 1000 / KEYSTROKE_RATE);

      // automatically focus the input canvas
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

      // catch click
      document.addEventListener('click', (event) => {
        this.focusedElement = event.target;
        for (const {DOMElement, callback} of this.clickCallbacks) {
          if (DOMElement.contains(event.target)) {
            const rect = DOMElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            callback(x, y);
          }
        }
      });

      // catch right click
      document.addEventListener('contextmenu', (event) => {
        for (const {DOMElement, callback} of this.rightClickCallbacks) {
          if (DOMElement.contains(event.target)) {
            const rect = DOMElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            callback(x, y);
          }
        }
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
   * Register a callback function on JoyStick.
   * The callback will be triggered every tick.
   * @param {Function} callback - Takes the joystick object as argument.
   */
  registerJoyStickEveryTick(callback) {
    this.joyStickEveryTickCallbacks.push(callback);
  }

  /**
   * Register a callback on the ghost mode button of JoyStick.
   * @param {Function} callback - Takes the state of the button as argument. (true|false)
   */
  registerJoyStickGhostModeButton(callback) {
    this.joystick.registerGhostModeButtonCallback(callback);
  }

  /**
   * Register a callback on the game button of JoyStick.
   * @param {Function} callback - Takes the click event as argument.
   */
  registerJoyStickGameButton(callback) {
    this.joystick.registerGameButtonCallback(callback);
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
   * Register a callback function on player's movement.
   * @param {Function} callback - Takes the movement direction as argument.
   */
  registerMapMove(callback) {
    // keyboard
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

    // joystick
    this.registerJoyStickEveryTick((joystick) => {
      const {x, y} = joystick.status;
      const r = Math.sqrt(x * x + y * y);
      if (r >= JOYSTICK_EFFECTIVE_RADIUS) {
        let direction;
        if (x >= Math.abs(y)) direction = 'R';
        else if (x < -Math.abs(y)) direction = 'L';
        else if (y >= Math.abs(x)) direction = 'D';
        else direction = 'U';
        callback(direction);
      }
    });
  }
}


/**
 * The panel for player moving on mobile device.
 * Can also be enabled when using desktop device.
 */
class JoyStick {
  /**
   * @constructor
   * @param {InputManager} inputManager - The input manager which this joystick belongs to.
   * @param {Element} containerDiv - The outer container of the joystick.
   * @param {Element} controlPointContainerDiv - The container of the joystick control point.
   * @param {Element} controlPointDiv - The div to display the stick of the joystick.
   * @param {Element} ghostModeDiv - The div to switch on/off ghost mode.
   * @param {Element} gameButtonDiv - The div used by game (usually by extensions).
   */
  constructor(inputManager, containerDiv, controlPointContainerDiv, controlPointDiv, ghostModeDiv, gameButtonDiv) {
    this.inputManager = inputManager;
    this.containerDiv = containerDiv;
    this.controlPointContainerDiv = controlPointContainerDiv;
    this.controlPointDiv = controlPointDiv;
    this.ghostModeDiv = ghostModeDiv;
    this.gameButtonDiv = gameButtonDiv;

    this.ghostModeCallback = [];
    this.gameButtonCallback = [];

    if (this.controlPointContainerDiv.offsetWidth !== this.controlPointContainerDiv.offsetHeight) {
      console.warn(`Joystick container should be a square! (currently ${this.controlPointContainerDiv.offsetWidth}px*${this.controlPointContainerDiv.offsetHeight}px)`);
    }

    this._status = {x: 0, y: 0};
    this.centerTheControlPoint();

    if ('ontouchstart' in document.documentElement) {
      this.controlPointContainerDiv.addEventListener('touchstart', this.startMoving.bind(this));
      window.addEventListener('touchmove', this.onMoving.bind(this));
      window.addEventListener('touchend', this.endMoving.bind(this));
    } else {
      this.controlPointContainerDiv.addEventListener('mousedown', this.startMoving.bind(this));
      window.addEventListener('mousemove', this.onMoving.bind(this));
      window.addEventListener('mouseup', this.endMoving.bind(this));
    }

    this.ghostModeStatus = false;
    this.updateGhostModeButtonStyle();

    this.inputManager.registerElementOnClick(this.ghostModeDiv, () => {
      this.ghostModeStatus ^= true;
      this.updateGhostModeButtonStyle();
      for (const cb of this.ghostModeCallback) {
        cb(this.ghostModeStatus);
      }
    });
    this.inputManager.registerElementOnClick(this.gameButtonDiv, () => {
      for (const cb of this.gameButtonCallback) {
        cb();
      }
    });
  }

  /**
   * Disable the JoyStick.
   */
  disable() {
    this.containerDiv.hidden = true;
    this.controlPointContainerDiv.hidden = true;
    this.controlPointDiv.hidden = true;
    this.ghostModeDiv.hidden = true;
    this.gameButtonDiv.hidden = true;
  }

  /**
   * Register a callback when ghost mode button is pressed.
   * @param {Function} callback - Takes the status of ghost mode as argument.
   */
  registerGhostModeButtonCallback(callback) {
    this.ghostModeCallback.push(callback);
  }

  /**
   * Register a callback when game button is pressed.
   * @param {Function} callback - Takes no argument.
   */
  registerGameButtonCallback(callback) {
    this.gameButtonCallback.push(callback);
  }

  /**
   * Reset the position of the control point.
   */
  centerTheControlPoint() {
    this.controlPointDiv.style.top = '50%';
    this.controlPointDiv.style.left = '50%';
    this._status.x = 0;
    this._status.y = 0;
  }

  /**
   * Set ghost mode button's style.
   */
  updateGhostModeButtonStyle() {
    // TODO: minor bug, this should be called when ghost mode is switched by keyboard
    this.ghostModeDiv.style.border = this.ghostModeStatus ? '3px solid #c0c' : '';
  }

  /**
   * Return current coordinate of the joystick. Is an object like {x, y}.
   * The joystick is a polar coordinate where x=r*cos(t) and y=r*sin(t).
   * Therefore, -1 <= x <= 1 and -1 <= y <= 1 and 0 <= x*x + y*y <= 1.
   */
  get status() {
    return this._status;
  }

  /**
   * Called when the user starts using the joystick.
   * @param {Event} event - the 'touchstart' or 'mousestart' event object
   */
  startMoving(event) {
    this._touched = true;
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Called when the user stops using the joystick.
   * @param {Event} event - the 'touchend' or 'mouseend' event object
   */
  endMoving(event) {
    this._touched = false;
    this.centerTheControlPoint();
  }

  /**
   * Called when the user is using the joystick.
   * @param {Event} event - the 'touchmove' or 'mousemove' event object
   */
  onMoving(event) {
    if (!this._touched) return;
    event.preventDefault();
    event.stopPropagation();

    const {x: topLeftX, y: topLeftY} = this.controlPointContainerDiv.getBoundingClientRect();
    const borderWidth = getComputedStyle(this.controlPointContainerDiv).getPropertyValue('border-left-width').replace('px', '');
    const containerSizeHalf = this.controlPointContainerDiv.offsetWidth / 2;
    const touchClientX = (event instanceof TouchEvent) ? event.targetTouches[0].clientX : event.clientX;
    const touchClientY = (event instanceof TouchEvent) ? event.targetTouches[0].clientY : event.clientY;
    const _joystickX = touchClientX - topLeftX - containerSizeHalf; // before clamping
    const _joystickY = touchClientY - topLeftY - containerSizeHalf; // before clamping
    const r = Math.sqrt(_joystickX * _joystickX + _joystickY * _joystickY) / (containerSizeHalf);
    const joystickX = _joystickX / Math.max(1, r);
    const joystickY = _joystickY / Math.max(1, r);
    this._status.x = joystickX / containerSizeHalf;
    this._status.y = joystickY / containerSizeHalf;

    // TODO: use joystickX and joystickY to determine the moving direction

    this.controlPointDiv.style.left = `${joystickX + containerSizeHalf - borderWidth}px`;
    this.controlPointDiv.style.top = `${joystickY + containerSizeHalf - borderWidth}px`;
  }
}


export default InputManager;
