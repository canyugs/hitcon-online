// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Input manager deals with all user input.
 */
class InputManager {
  mapRender = null
  canvas = null
  clickCallbacks = []
  moveCallbacks = []
  canvasX = NaN
  canvasY = NaN

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
    const {x, y} = this.canvas.getClientRects()[0];
    this.canvasX = x;
    this.canvasY = y;

    this.canvas.addEventListener('click', this.handleClick.bind(this));

    let focus = false;
    document.addEventListener('click', (event) => {
      focus = event.target === this.canvas;
    });
    document.addEventListener('keydown', (event) => {
      focus && this.handleKeydown(event);
    });

    document.addEventListener('resize', () => {
      const {x, y} = this.canvas.getClientRects()[0];
      this.canvasX = x;
      this.canvasY = y;
    });
  }

  handleClick(event) {
    const {clientX: touchX, clientY: touchY} = event;
    const [viewX, viewY] = [touchX - this.canvasX, touchY - this.canvasY];
    const {x: mapX, y: mapY} = this.mapRender.canvasToMapCoordinate(viewX, viewY);
    this.clickCallbacks.forEach((fn) => fn(mapX, mapY));
  }

  handleKeydown(event) {
    const {keyCode} = event;
    let direction = null;
    switch (keyCode) {
      case 87: // W
      case 38: // ArrowUp
      case 104: // NumPad 8
        direction = 'U';
        break;
      case 83: // S
      case 40: // ArrowDown
      case 98: // NumPad 2
        direction = 'D';
        break;
      case 65: // A
      case 37: // ArrowLeft
      case 100: // NumPad 4
        direction = 'L';
        break;
      case 68: // D
      case 39: // ArrowRight
      case 102: // NumPad 6
        direction = 'R';
        break;
    }
    direction && this.moveCallbacks.forEach((fn) => fn(direction));
  }

  /**
   * Register a callback for map click.
   * This should only be called once.
   * @param {function} callback - The callback to call when the player clicked
   * @return {{off: function}} - A off function to remove callback
   * on the map. The prototype for callback is:
   * async function (x, y)
   * Where x and y is the coordinate in the map.
   */
  onMapClick(callback) {
    this.clickCallbacks.push(callback);

    return {
      off() {
        this.clickCallbacks = this.clickCallbacks.filter((cb) => cb !== callback);
      },
    };
  }

  /**
   * Register a callback for player movement.
   * Whenever player wants to move, callback will be called.
   * Callback will be called repeatedly if the player continues to want to
   * move. i.e. If the player holds the arrow key, callback will be called
   * periodically.
   * @param {function} callback - The callback to call when the player tries to
   * @return {{off: function}} - A off function to remove callback
   * move. The prototype for callback is:
   * async function(direction)
   * Where direction is one of: 'U', 'D', 'L', 'R'
   */
  onMove(callback) {
    this.moveCallbacks.push(callback);

    return {
      off() {
        this.moveCallbacks = this.moveCallbacks.filter((cb) => cb !== callback);
      },
    };
  }
}

export default InputManager;
