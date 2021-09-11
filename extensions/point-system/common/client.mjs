// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const REMIANING_POINTS_DIV = 'remaining-points-overlay';
const POINT_SYSTEM_LOCATION = 'http://ho.zuan.im:4000/api/v1';

class RemainingPointsOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(REMIANING_POINTS_DIV);
    super(mainUI, dom);
  }
};

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
    this.registerResult = false;
  }

  async gameStart() {
    this.overlay = new RemainingPointsOverlay(this.helper.mainUI);
    this.overlay.show(OverlayPosition.LEFT_BOTTOM);

    // Register the user
    this.registerResult = await this.helper.callC2sAPI('point-system', 'registerUser', 5000);
    if (this.registerResult !== true) {
      console.log("Failed to register to the points system: ", this.registerResult);
    }

    await this.updatePoints();
  }

  /**
   * Update the displayed points
   */
  async updatePoints() {
    if (!this.registerResult) {
      return false;
    }

    let p = await this.getPoints();
    $('#remaining-points').text('$' + p.toString());
  }

  /**
   * Get the remaining points of the user.
   */
  async getPoints() {
    if (!this.registerResult) {
      return false;
    }

    try {
      let ret = await this.requestApi('/users/me', 'GET');
      return ret?.points;
    } catch (e) {
      console.error(e);
      throw new Error('Failed to get the remaining points.');
    }
  }

  /**
   * Transfer the points to the specific user.
   * @param {Number} points The number of points to be transferred.
   * @param {string} receiver The uid of the receiver.
   */
   async transferPoints(points, receiver) {
    if (!this.registerResult) {
      return false;
    }

    try {
      let ret = await this.requestApi('/points/transactions', 'POST', {
        points: points,
        receiver: receiver
      });
      await this.updatePoints();
      return ret?.message === "OK";
    } catch (e) {
      console.error(e);
      throw new Error('Failed to transfer points.');
    }
  }

  /**
   * Send request to the API endpoint.
   * @param endpoint The API endpoint, should contain the leading `/`.
   * @param method The HTTP method.
   * @param data Request body.
   * @returns
   */
  requestApi(endpoint, method, data) {
    return $.ajax({
      url: POINT_SYSTEM_LOCATION + endpoint,
      method: method,
      dataType: "json",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.getToken()
      },
      processData: false,
      data: JSON.stringify(data)
    });
  }

  /**
   * Get the JWT token.
   * TODO: this method would not work when we use HttpOnly. May need to seek other ways to get the token securely.
   * @returns token
   */
  getToken() {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; token=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

}

export default Client;
