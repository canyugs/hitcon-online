// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../maplib/map.mjs';
import {PLAYER_MOVE_TIME_INTERVAL} from './move-check.mjs';

/**
 * This module provides an interface of player object.
 * It should be used whenever anyone wants to pass players to function calls or between client and server.
 */

const PLAYER_MOVE_ANIMATION_FRAME_RATE = 60; // ms per frame
const PLAYER_DISPLAY_NAME_MAX_LENGTH = 14;

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
      'lastMovingTime', // the time recorded on the server
      'ghostMode',
    ];

    this.playerID = playerID;
    this._displayName = undefined;
    this.displayChar = undefined;
    this.mapCoord = undefined;
    this.facing = undefined;
    this.lastMovingTime = undefined;
    this.ghostMode = false;

    // only on client side
    this.lastMovingTimeClient = 0;
    this.mainPlayer = false;
  }

  get displayName() {
    return this._displayName;
  }

  set displayName(newName) {
    this._displayName = newName.substr(0, PLAYER_DISPLAY_NAME_MAX_LENGTH);
  }

  /**
   * Used by MapRenderer.
   * @return {Object}
   */
  getDrawInfo() {
    // smoothly move the player
    const now = Date.now();
    const lastMovingTime = (this.mainPlayer) ? this.lastMovingTimeClient : this.lastMovingTime;
    const smoothMoveEnd = lastMovingTime + PLAYER_MOVE_TIME_INTERVAL;
    let retMapCoord;
    let retFacing;
    if (now < smoothMoveEnd) {
      // moving, calculate interpolated coordinate
      const inter = MapCoord.fromObject(this.mapCoord);
      const frac = (now - lastMovingTime) / PLAYER_MOVE_TIME_INTERVAL;
      inter.x = (1 - frac) * this._previousMapCoord.x + frac * this.mapCoord.x;
      inter.y = (1 - frac) * this._previousMapCoord.y + frac * this.mapCoord.y;
      retMapCoord = inter;
      // calculate the moving animation phase
      const phase = Math.floor(now / PLAYER_MOVE_ANIMATION_FRAME_RATE) % 4;
      if (phase === 0) {
        retFacing = this.facing + 'R';
      } else if (phase === 2) {
        retFacing = this.facing + 'L';
      } else { // phase === 1 || phase === 3
        retFacing = this.facing;
      }
    } else {
      retMapCoord = this.mapCoord;
      retFacing = this.facing;
    }

    return {
      mapCoord: retMapCoord,
      displayChar: this.displayChar,
      facing: retFacing,
      displayName: this.displayName,
      ghostMode: this.ghostMode,
    };
  }

  /**
   * Update the player data from the message.
   * @param {PlayerSyncMessage} msg - The message.
   * @param {String} movingTime - Which moving time is to be updated. Empty string means don't update.
   * @return {Boolean} - Whether the update succeeds or not.
   */
  updateFromMessage(msg, movingTime='server') {
    if (msg.playerID !== this.playerID) {
      return false;
    }
    // TODO: check whether msg is in the correct format
    if (msg.mapCoord !== undefined) {
      if (this.mapCoord !== undefined && !msg.mapCoord.equalsTo(this.mapCoord)) {
        if (movingTime === 'client' || movingTime === 'both') this.lastMovingTimeClient = Date.now();
        if (movingTime === 'server' || movingTime === 'both') this.lastMovingTime = Date.now();
        if (!['client', 'server', 'both'].includes(movingTime)) console.warn(`Invalid parameter \`movingTime\` when updating player, msg = ${msg}`);
      }
      this._previousMapCoord = (this.mapCoord ?? msg.mapCoord); // for smooth moving of the player
      this.mapCoord = msg.mapCoord;
    }
    if (msg.facing !== undefined) this.facing = msg.facing;
    if (msg.displayName !== undefined && Player.displayNameValidation(msg.displayName)) this.displayName = msg.displayName;
    if (msg.displayChar !== undefined && Player.displayCharValidation(msg.displayChar)) this.displayChar = msg.displayChar;
    if (msg.removed !== undefined) this.removed = msg.removed;
    if (msg.ghostMode !== undefined) this.ghostMode = msg.ghostMode;
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
      ret._previousMapCoord = MapCoord.fromObject(obj.mapCoord);
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

  /**
   * Check whether displayName is valid.
   * @param {String} displayName
   * @return {Boolean}
   */
  static displayNameValidation(displayName) {
    // TODO
    return true;
  }

  /**
   * Check whether displayChar is valid.
   * @param {String} displayChar
   * @return {Boolean}
   */
  static displayCharValidation(displayChar) {
    // TODO
    return true;
  }
}

/**
 * The message between client and server to synchronize player's status.
 * Note that the ALL the fields in this class can be modified by user.
 */
class PlayerSyncMessage {
  constructor(playerID, mapCoord, facing, displayName, displayChar, removed, clientTime, updateSuccess, ghostMode, lastMovingTime) {
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
    this.clientTime = clientTime; // a counter
    this.updateSuccess = updateSuccess; // used by server to tell client whether success or not
    this.ghostMode = ghostMode;
    this.lastMovingTime = lastMovingTime;
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
    if (this.clientTime !== undefined) ret.clientTime = this.clientTime;
    if (this.updateSuccess !== undefined) ret.updateSuccess = this.updateSuccess;
    if (this.ghostMode !== undefined) ret.ghostMode = this.ghostMode;
    if (this.lastMovingTime !== undefined) ret.lastMovingTime = this.lastMovingTime;
    return ret;
  }

  /**
   * Check that the displayName and displayChar is correct.
   */
  check(graphicAsset) {
    if (this.facing !== undefined && !['U', 'D', 'L', 'R'].includes(this.facing)) {
      console.warn('Got invalid facing: ', this.facing, this);
      return false;
    }
    if (this.displayName !== undefined && (typeof this.displayName !== 'string' || this.displayName.length <= 0 || this.displayName.length > PLAYER_DISPLAY_NAME_MAX_LENGTH)) {
      console.warn('Got invalid displayName: ', this.displayName, this);
      return false;
    }
    if (this.displayChar !== undefined && (typeof this.displayChar !== 'string' || !graphicAsset.hasCharacter(this.displayChar))) {
      console.warn('Got invalid displayChar: ', this.displayChar, this);
      return false;
    }
    if (graphicAsset.isCharNPC(this.displayChar)) {
      console.warn('Got NPC in PlayerSyncMessage: ', this.displayChar, this);
      return false;
    }
    return true;
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
    if (obj.clientTime !== undefined) ret.clientTime = obj.clientTime;
    if (obj.updateSuccess !== undefined) ret.updateSuccess = obj.updateSuccess;
    if (obj.ghostMode !== undefined) ret.ghostMode = obj.ghostMode;
    if (obj.lastMovingTime !== undefined) ret.lastMovingTime = obj.lastMovingTime;
    return ret;
  }
}

export default Player;

export {
  Player,
  PlayerSyncMessage,
  PLAYER_DISPLAY_NAME_MAX_LENGTH,
};
