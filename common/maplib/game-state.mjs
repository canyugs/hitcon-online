// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from './cellset.mjs';
import {MapCoord} from './map.mjs';

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
    /*
     * Format of player in players:
     * {string} playerID - ID of the player. Key in players.
     * {string} displayName - The name to display for the player.
     * {Number} x - The x coordinate.
     * {Number} y - The y coordinate.
     * {string} facing - 'U', 'D', 'L', 'R', the direction user's facing.
     */
    this.players = {};

    /**
     * An example of this.cellSets:
     *  {
     *    "map1": {"cellSetName1": cellSet1, cellSetName2: cellSet2},
     *    "map2": {"cellSetName1": cellSet3},
     *  }
     */
    this.cellSetsOfMaps = {};

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
      const obj = this.players[playerID];
      if ('displayName' in loc) obj.displayName = loc.displayName;
      if ('displayChar' in loc) obj.displayChar = loc.displayChar;
      obj.mapCoord = MapCoord.fromObject(loc.mapCoord);
      obj.facing = loc.facing;
    }
    for (const f of this.locationCallbacks) {
      f(loc);
    }
  }

  /**
   * This is called when a cell set event (set or clear) is received from the
   * game server or upper layer.
   * Usually this is called by the game client or redis client.
   * @param {String} op - The operation type: "set", "unset", or "update"
   * @param {String} mapName - The map which this cell set applies to.
   * @param {CellSet} cellSet - The cell set object.
   */
  onCellSet(op, mapName, cellSet) {
    const csom = this.cellSetsOfMaps; // alias
    switch (op) {
      case 'unset':
        delete csom[mapName][cellSet.name];
        this.gameMap.unsetDynamicCellSet(mapName, cellSet.name);
        break;

      case 'set':
        if (typeof csom[mapName] === 'undefined') csom[mapName] = {};
        csom[mapName][cellSet.name] = cellSet;
        this.gameMap.setDynamicCellSet(mapName, CellSet.fromObject(cellSet));
        break;

      case 'update':
        csom[mapName][cellSet.name].cells = cellSet.cells;
        this.gameMap.updateDynamicCellSet(mapName, cellSet.name, cellSet.cells);
        break;

      default:
        throw `Unknown cellSet update object with type ${op}`;
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
    return this.cellSetsOfMaps;
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
    return {players: this.players, cellSetsOfMaps: this.cellSetsOfMaps};
  }

  /**
   * Accept a state transfer from upstream. Synchronizing the state of this
   * class with that of the upstream.
   * @param {object} state - State returned by getStateTransfer().
   */
  acceptStateTransfer(state) {
    this.players = state.players;
    this.cellSetsOfMaps = state.cellSetsOfMaps;
    this.gameMap.removeAllDynamicCellSet();
    for (const mapName of Object.keys(this.cellSetsOfMaps)) {
      for (const cs of Object.values(this.cellSetsOfMaps[mapName])) {
        // ensure that cs is an instance of CellSet
        const cs_ = CellSet.fromObject(cs);
        this.cellSetsOfMaps[mapName][cs.name] = cs_;
        this.gameMap.setDynamicCellSet(mapName, cs_);
      }
    }
  }
}

export default GameState;
