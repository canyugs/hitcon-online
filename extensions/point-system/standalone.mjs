// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {createRequire} from 'module';
const require = createRequire(import.meta.url);
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
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
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
   * Notify other users to update the points.
   * @param {Player} player - player information
   * @param {string} uid - The user to be notified.
   */
  async c2s_notifyUpdatePoints(player, uid) {
    try {
      return await this.helper.callS2cAPI(uid, 'point-system', 'updatePoints', 5000);
    } catch (e) {
      return false;
    }
  }

  /**
   * Send request to the point system.
   * @param {string} endpoint
   */
  requestApi(endpoint, method, data, token) {
    return axios({
      url: POINT_SYSTEM_LOCATION + endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      data: data
    });
  }
}

export default Standalone;
