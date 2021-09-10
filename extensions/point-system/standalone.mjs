// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const config = require('config');
const axios = require('axios');

const POINT_SYSTEM_LOCATION = 'http://ho.zuan.im:4000/api/v1';

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;

    // Maintain a user list cache to prevent communication overhead.
    // TODO: we should ensure that the user has registered to the point system in the first place,
    // so that we don't need to register new users here.
    this.userListCache = [];
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    await this.refreshUserListCache();
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }

  /**
   * Register a new user.
   * TODO: we should move the register stage out of HITCON online.
   * @param {Player} player - player information
   * @returns string
   */
  async c2s_registerUser(player) {
    console.log('c2s_registerUser');
    try {
      if (this.userListCache.filter(m => m.uid === player.playerID).length > 0) {
        console.warn(`${player.playerID} had already registered to the point system.`);
        return true;
      }
      let ret = await this.requestApiAsAdmin('/users', 'POST', {
        'uid': player.playerID,
        'role': 'client',
        'points': 0
      });

      await this.refreshUserListCache();

      console.log(`${player.playerID} has registered to the point system.`);
      return ret.status === 200;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Refresh the user list cache. Called when we expected the user list to update.
   */
  async refreshUserListCache() {
    try {
      this.userListCache = (await this.requestApiAsAdmin('/users', 'GET'))?.data;
      console.log(this.userListCache);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Send request to the point system with all credential set up.
   * @param {string} endpoint
   */
  requestApiAsAdmin(endpoint, method, data) {
    return axios({
      url: POINT_SYSTEM_LOCATION + endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.getAdminToken()
      },
      data: data
    });
  }

  /**
   * Get JWT token with admin permission.
   */
  getAdminToken() {
    let token = jwt.sign({
      scope: ['point_system', 'admin']
    }, config.get('secret'), {expiresIn: 60 * 60 * 24 * 365});
    console.log(config.get('secret'), token);
    return token;
  }
}

export default Standalone;
