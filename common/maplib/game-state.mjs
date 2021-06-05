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
    this.players = {};
    /*
     * Format of player in players:
     * {string} playerID - ID of the player. Key in players.
     * {string} displayName - The name to display for the player.
     * {Number} x - The x coordinate.
     * {Number} y - The y coordinate.
     * {string} facing - 'U', 'D', 'L', 'R', the direction user's facing.
     */
    this.cellSet = {};

    this.locationCallbacks = [];
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
    const playerID = loc.playerID;
    if ('removed' in loc && loc['removed']) {
      // Player is removed. Disconnected.
      if (playerID in this.players) {
        delete this.players[playerID];
      }
    } else {
      if (!(playerID in this.players)) {
        this.players[playerID] = {playerID: playerID};
        // The default, wait for it to be updated later.
        this.players[playerID].displayName = playerID;
      }
      let obj = this.players[playerID];
      if ('displayName' in loc) obj.displayName = loc.displayName;
      if ('displayChar' in loc) obj.displayChar = loc.displayChar;
      [obj.x, obj.y, obj.facing] = [loc.x, loc.y, loc.facing];
    }
    for (const f of this.locationCallbacks) {
      f(loc);
    }
  }

  /**
   * This is called when a cell set event (set or clear) is received from the
   * game server or upper layer.
   * Usually this is called by the game client or redis client.
   * @param {object} cset - The cell set update object.
   * It have an attribute "type", it's either set or unset.
   * Then it have another attribute "name", the name of the cell set.
   * Lastly, if type is set, then attribute "cellSet" is the cell set object.
   */
  onCellSet(cset) {
    if (cset.type == 'unset') {
      delete this.cellSet[cset.name];
      this.gameMap.unsetDynamicCellSet(cset.name);
    } else if (cset.type == 'set') {
      this.cellSet[cset.name] = cset.cellSet;
      this.gameMap.setDynamicCellSet(cset.cellSet);
    } else {
      throw `Unknown cellSet update object with type ${cset.type}`;
    }
  }

  /**
   * Register a callback whenever user's location is changed or user is
   * removed.
   * @param {object} callback - A callback whenever there's any update on
   * user's location. Its signature is:
   * function (loc)
   * Where loc is the location object.
   * The callback is called after any state update.
   */
  registerPlayerLocationChange(callback) {
    this.locationCallbacks.push(callback);
  }

  /**
   * Get a list of all player's state/location.
   * @return {object} state - An array of location/state object. For
   * documentation on location object, see constructor on this.players.
   */
  getPlayers() {
    return this.players;
  }

  /**
   * Get a map of all cell set that's active.
   */
  getCellSets() {
    return this.cellSet;
  }

  /**
   * Get information regarding a player.
   * @param {string} playerID - The player's ID.
   * @return {object} state - An object representing player's state.
   */
  getPlayer(playerID) {
    if (playerID in this.players) {
      return this.players[playerID];
    }
    return null;
  }

  /**
   * Get an object for state transfer.
   * @return {object} state - The game state.
   */
  getStateTransfer() {
    return {players: this.players, cellSet: this.cellSet};
  }

  /**
   * Accept a state transfer from upstream. Synchronizing the state of this
   * class with that of the upstream.
   * @param {object} state - State returned by getStateTransfer().
   */
  acceptStateTransfer(state) {
    this.players = state.players;
    this.cellSet = state.cellSet;
    this.gameMap.removeAllDynamicCellSet();
    for (const name in this.cellSet) {
      this.gameMap.setDynamicCellSet(this.cellSet[name]);
    }
  }
}

export default GameState;
