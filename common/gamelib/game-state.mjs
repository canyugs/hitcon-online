// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from '../maplib/cellset.mjs';
import Player from './player.mjs';

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

    /**
     * @member {Map} players - The players
     * Since mapRenderer uses `this.players` to render players, we use `Object.defineProperty`
     * to prevent reassignment.
     * Format of player in players:
     * {string} playerID - ID of the player. Key in players.
     * {string} displayName - The name to display for the player.
     * {Number} x - The x coordinate.
     * {Number} y - The y coordinate.
     * {string} facing - 'U', 'D', 'L', 'R', the direction user's facing.
     */
    this.players = undefined;
    Object.defineProperty(this, 'players', {value: new Map(), enumerable: true});

    /**
     * An example of this.cellSets:
     *  {
     *    "map1": {"cellSetName1": cellSet1, cellSetName2: cellSet2},
     *    "map2": {"cellSetName1": cellSet3},
     *  }
     */
    this.cellSetsOfMaps = {};

    this.playerUpdateCallbacks = [];
  }

  /**
   * This is called when a playerUpdate event is received from the game server or
   * upper layer.
   * Usually this is called by the game client or redis client.
   * @param {PlayerSyncMessage} msg - The update message.
   */
  onPlayerUpdate(msg) {
    const playerID = msg.playerID;
    if (msg.removed) {
      // Player is removed. Disconnected.
      if (this.players.has(playerID)) {
        delete this.players.delete(playerID);
      }
    } else {
      if (!this.players.has(playerID)) this.players.set(playerID, new Player(playerID));
      this.players.get(playerID).updateFromMessage(msg);
    }
    for (const f of this.playerUpdateCallbacks) {
      f(msg);
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
   * Register a callback whenever any player is updated.
   * @param {object} callback - A callback whenever there's any update on
   * players. The callback takes a `PlayerSyncMessage` as parameter.
   */
  registerOnPlayerUpdate(callback) {
    this.playerUpdateCallbacks.push(callback);
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
    if (this.players.has(playerID)) {
      return this.players.get(playerID);
    }
    return null;
  }

  /**
   * Get an object for state transfer.
   * @return {object} state - The game state.
   */
  getStateTransfer() {
    return {players: JSON.stringify(Object.fromEntries(this.players)), cellSetsOfMaps: this.cellSetsOfMaps};
  }

  /**
   * Accept a state transfer from upstream. Synchronizing the state of this
   * class with that of the upstream.
   * @param {object} state - State returned by getStateTransfer().
   */
  acceptStateTransfer(state) {
    // update players
    const newPlayers = new Map(Object.entries(JSON.parse(state.players)));
    this.players.clear();
    for (const [k, v] of newPlayers.entries()) {
      this.players.set(k, Player.fromObject(v));
    }

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
