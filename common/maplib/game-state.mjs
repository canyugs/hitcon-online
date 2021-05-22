// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * GameState represents the state of the map while the game is running.
 * For example, it records where each player is, if there's any object on the
 * map, and if doors are open... etc.
 * This is used in both the game client (browser side) and in the area
 * broadcaster (server side).
 */
class GameState {
  /**
   * Create an empty map state.
   * @constructor
   * @param {GameMap} gameMap - The GameMap object for getting information on
   * the current map.
   */
  constructor(gameMap) {
    this.gameMap = gameMap;
  }

  /**
   * This is called when a location event is received from the game server or
   * upper layer.
   * Usually this is called by the game client or redis client.
   * @param {object} loc - The location object.
   * See the documentation in GatewayService for more info on the loc object's
   * format. It is the same format as the one on socket.on('location')
   */
  onLocation(loc) {
    void loc;
    console.error('Not implemented.');
  }

  /**
   * Register a callback whenever user's location is changed or user is
   * removed.
   * @param {object} callback - A callback whenever there's any update on
   * user's location. Its signature is:
   * function (loc)
   * Where loc is the location object.
   */
  registerPlayerLocationChange(callback) {
    void callback;
    console.error('Not implemented.');
  }

  /**
   * Get a list of all player's location.
   * @return {object} locations - An array of location object. For
   * documentation on location object, see above.
   */
  getPlayerLocations() {
    console.error('Not implemented.');
    return [];
  }
}

export default GameState;
