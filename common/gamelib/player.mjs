// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../maplib/map.mjs';

/**
 * This module provides an interface of player object.
 * It should be used whenever anyone wants to pass players to function calls or between client and server.
 */

/**
 * The player class.
 */
class Player {
  /**
   * Create a player object.
   * @param {String} playerID - The player's ID.
   */
  constructor(playerID) {
    this.ATTRIBUTES = [
      'playerID',
      'displayName',
      'displayChar',
      'mapCoord',
      'facing',
      'lastMovingTime',
    ];

    this.playerID = playerID;
    this.displayName = playerID;
    this.displayChar = 'char1';
    this.mapCoord = undefined; // TODO: Set it to a spawn point specified by map.json.
    this.facing = 'D';
    this.lastMovingTime = undefined;
  }

  /**
   * The serialization used by JSON.stringify().
   * @return {Object}
   */
  toJSON() {
    const ret = {};
    for (const key of this.ATTRIBUTES) {
      if (typeof this[key].toJSON === 'function') {
        ret[key] = this[key].toJSON();
      } else {
        ret[key] = this[key];
      }
    }
    return ret;
  }

  /**
   * Deserialize a JSON object into Player.
   * @param {Object} obj - TODO
   * @return {Player}
   */
  static fromObject(obj) {
    const ret = new Player(obj.playerID);

    function assignIfDefined(objdst, objsrc, key) {
      if (key in objsrc) {
        objdst[key] = objsrc[key];
      }
    }

    for (const key of ret.ATTRIBUTES) {
      assignIfDefined(ret, obj, key);
    }

    // special case for mapCoord
    if (obj.mapCoord !== undefined) {
      ret.mapCoord = MapCoord.fromObject(obj.mapCoord);
    }
    return ret;
  }

  /**
   * Return the redis key of the player.
   * @param {String} playerID - The player's ID.
   * @return {String}
   */
  static getRedisKey(playerID) {
    return `p-${playerID}`;
  }

  /**
   * Return the redis key of the player.
   * @return {String}
   */
  getRedisKey() {
    return Player.getRedisKey(this.playerID);
  }

  /**
   * Return the key used in DataStore.
   * @param {String} playerID - The player's ID.
   * @return {String}
   */
  static getDataStoreKey(playerID) {
    return `p-${playerID}`;
  }

  /**
   * Return the key used in DataStore.
   * @return {String}
   */
  getDataStoreKey() {
    return Player.getDataStoreKey(this.playerID);
  }
}

export default Player;
