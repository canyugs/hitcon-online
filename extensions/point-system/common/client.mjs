// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const POINT_SYSTEM_LOCATION = 'http://ho.zuan.im:4000/api/v1';

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
  }

  async gameStart() {
    this.helper.mainUI.contextMenu.addToOthersMenu('Transfer Points', 'https://via.placeholder.com/15x15', (player) => {
      // TODO: use modal or something else instead of prompt.
      this.transferPoints(parseInt(prompt("How many points to transfer:", 0)), player.playerID);
    });

    await this.s2c_updatePoints();
  }

  /**
   * Update the displayed points
   */
  async s2c_updatePoints() {
    let p = await this.getPoints();
    $('#user-point').text(p.toString());
    return true;
  }

  /**
   * Get the remaining points of the user.
   */
  async getPoints() {
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
    try {
      let ret = await this.requestApi('/points/transactions', 'POST', {
        points: points,
        receiver: receiver
      });
      await this.s2c_updatePoints();
      this.notifyUpdatePoints(receiver);
      return ret?.message === "OK";
    } catch (e) {
      console.error(e);
      throw new Error('Failed to transfer points.');
    }
  }

  /**
   * Notify other users to update the points.
   * @param uid User id
   */
  async notifyUpdatePoints(uid) {
    return await this.helper.callC2sAPI('point-system', 'notifyUpdatePoints', this.helper.defaultTimeout, uid);
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
        'Authorization': 'Bearer ' + this.helper.getToken()
      },
      processData: false,
      data: JSON.stringify(data)
    });
  }
}

export default Client;
