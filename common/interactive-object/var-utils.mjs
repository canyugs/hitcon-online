// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const GLOB_KEY = 'global_vars';
const PPLAYER_KEY = 'per_player_vars';
const POBJ_KEY = 'per_obj_vars';
const UNIQ_KEY = 'uniq_vars';

/**
 * VarUtils provides utilities for accessing variables.
 */
class VarUtils {
  /**
   * Create the VarUtils
   */
  constructor(helper) {
    this.helper = helper;
  }

  /*
   * Variable types:
   * @ => Global variable, shared amongst all interactive objects and
   *      all players.
   * % => Per player variable, shared amongst all interactive objects but
   *      will be different per player.
   * # => Per interactive objects variable, shared amongst all players.
   * $ => Per player and per interactive object variable, is unique per player
   *      and per object.
   */

  /**
   * Read a variable.
   * @return {String} result - The result that is a string. undefined if
   *   failed.
   */
  async readVar(varName, playerID, objID) {
    if (typeof varName !== 'string' || varName.length < 2 || (
      varName[0] !== '@' && varName[0] !== '%' &&
      varName[0] !== '#' && varName[0] !== '$')
    ) {
      console.warn('Tried to read invalid varName with VarUtils.readVar(): ', varName);
      return undefined;
    }

    const {rkey, rfield} = this.getVarInfo(varName, playerID, objID);
    const res = await this.helper.rpcHandler.redisHGet(rkey, rfield);
    return res;
  }

  /**
   * Write a variable.
   * @return {boolean} success - Whether the write is successful.
   */
  async writeVar(varName, playerID, objID, value) {
    if (typeof varName !== 'string' || varName.length < 2 || (
      varName[0] !== '@' && varName[0] !== '%' &&
      varName[0] !== '#' && varName[0] !== '$')
    ) {
      console.warn('Tried to write invalid varName with VarUtils.writeVar(): ', varName);
      return undefined;
    }

    const {rkey, rfield} = this.getVarInfo(varName, playerID, objID);
    return await this.helper.rpcHandler.redisHSet(rkey, rfield, value);
  }

  /**
   * Return the field and key for the given variable name, playerID and objID.
   */
  getVarInfo(varName, playerID, objID) {
    const nVarName = varName.substr(1);
    let rkey = '';
    let rfield = '';
    if (varName[0] === '@') {
      rkey = GLOB_KEY;
      rfield = `${nVarName}`;
    } else if (varName[0] === '%') {
      rkey = PPLAYER_KEY;
      rfield = `${playerID}####${nVarName}`;
    } else if (varName[0] === '#') {
      rkey = POBJ_KEY;
      rfield = `${objID}####${nVarName}`;
    } else if (varName[0] === '$') {
      rkey = UNIQ_KEY;
      rfield = `${playerID}####${objID}####${nVarName}`;
    } else {
      console.assert(false, 'Should not happen, invalid varName: ', varName);
    }
    return {rkey, rfield};
  }
}

export default VarUtils;
