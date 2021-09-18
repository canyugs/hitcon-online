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
   * Used by MapRenderer.
   * @return {Object}
   */
  getDrawInfo() {
    return {
      mapCoord: this.mapCoord,
      displayChar: this.displayChar,
      facing: this.facing,
      displayName: this.displayName,
    };
  }

  /**
   * Update the player data from the message.
   * @param {PlayerSyncMessage} msg - The message.
   * @return {Boolean} - Whether the update succeeds or not.
   */
  updateFromMessage(msg) {
    if (msg.playerID !== this.playerID) {
      return false;
    }
    // TODO: check whether msg is in the correct format
    if (msg.mapCoord !== undefined) this.mapCoord = msg.mapCoord;
    if (msg.facing !== undefined) this.facing = msg.facing;
    if (msg.displayName !== undefined) this.displayName = msg.displayName;
    if (msg.displayChar !== undefined) this.displayChar = msg.displayChar;
    if (msg.removed !== undefined) this.removed = msg.removed;
    return true;
  }

  /**
   * The serialization used by JSON.stringify().
   * @return {Object}
   */
  toJSON() {
    const ret = {};
    for (const key of this.ATTRIBUTES) {
      ret[key] = this[key];
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

/**
 * The message between client and server to synchronize player's status.
 */
class PlayerSyncMessage {
  constructor(playerID, mapCoord, facing, displayName, displayChar, removed) {
    if (playerID === undefined) {
      console.error(`'playerID' of class 'PlayerSyncMessage' should not be undefined.`);
      return;
    }

    this.playerID = playerID;
    this.mapCoord = mapCoord;
    this.facing = facing;
    this.displayName = displayName;
    this.displayChar = displayChar;
    this.removed = removed ?? false;
  }

  /**
   * The serialization used by JSON.stringify().
   * @return {Object}
   */
  toJSON() {
    // If the attribute does not exist, then we don't insert it into the message.
    // In this way, we can slightly reduce the size of the message.
    const ret = {playerID: this.playerID};
    if (this.mapCoord !== undefined) ret.mapCoord = this.mapCoord;
    if (this.facing !== undefined) ret.facing = this.facing;
    if (this.displayName !== undefined) ret.displayName = this.displayName;
    if (this.displayChar !== undefined) ret.displayChar = this.displayChar;
    if (this.removed !== undefined) ret.removed = this.removed;
    return ret;
  }

  /**
   * Deserialize a JSON object into Player.
   * @param {Object} obj - TODO
   * @return {Player}
   */
  static fromObject(obj) {
    const ret = new PlayerSyncMessage(obj.playerID);
    if (obj.mapCoord !== undefined) ret.mapCoord = MapCoord.fromObject(obj.mapCoord);
    if (obj.facing !== undefined) ret.facing = obj.facing;
    if (obj.displayName !== undefined) ret.displayName = obj.displayName;
    if (obj.displayChar !== undefined) ret.displayChar = obj.displayChar;
    if (obj.removed !== undefined) ret.removed = obj.removed;
    return ret;
  }
}

export default Player;
export {
  Player,
  PlayerSyncMessage,
};
