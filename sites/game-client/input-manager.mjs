// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
  }

  /**
   * Register a callback for map click.
   * This should only be called once.
   * @param {function} callback - The callback to call when the player clicked
   * on the map. The prototype for callback is:
   * async function (x, y)
   * Where x and y is the coordinate in the map.
   */
  onMapClick(callback) {
  }

  /**
   * Register a callback for player movement.
   * Whenever player wants to move, callback will be called.
   * Callback will be called repeatedly if the player continues to want to
   * move. i.e. If the player holds the arrow key, callback will be called
   * periodically.
   * @param {function} callback - The callback to call when the player tries to
   * move. The prototype for callback is:
   * async function(direction)
   * Where direction is one of: 'U', 'D', 'L', 'R'
   */
  onMove(callback) {
  }
}

export default InputManager;
