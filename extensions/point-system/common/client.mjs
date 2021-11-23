// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
    this.pointSystemAddress = await this.helper.callC2sAPI('point-system', 'getPointSystemAddress', this.helper.defaultTimeout);
    this.helper.mainUI.contextMenu.addToOthersMenu('Transfer Points', 'https://via.placeholder.com/15x15', async (player) => {
      let points = (await this.helper.getExtObj('dialog')?.modal.displayAsPrompt(
        'Transfer Points',
        `How many points do you want to transfer to ${player.displayName}? Only positive integer is allowed.`,
        'Submit'
      ))?.msg;

      if (await this.transferPoints(parseInt(points, 10), player.playerID)) {
        this.helper.mainUI.showNotification('Point transferred successfully.', 5000);
        this.notifyUpdatePoints(player.playerID, 'TRASNFERRED');
      } else {
        this.helper.mainUI.showNotification('Failed to transfer points. ', 5000);
      }
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
      return ret?.data?.points;
    } catch (e) {
      console.error('Failed to get points for user', e);
      throw new Error('Failed to get the remaining points.');
    }
  }

  /**
   * Transfer the points to the specific user.
   * @param {Number} points The number of points to be transferred.
   * @param {string} receiver The uid of the receiver.
   */
  async transferPoints(points, receiver) {
    if (!Number.isInteger(points) || points <= 0) {
      console.error('Illegal points recieved:', points);
      return false;
    }
    try {
      let ret = await this.requestApi('/points/transactions', 'POST', {
        points: points,
        receiver: receiver
      });
      await this.s2c_updatePoints();
      return ret?.success;
    } catch (e) {
      console.error('Failed to transfer points: ', e);
      return false;
    }
  }

  /**
   * Redeem the points to the specific user.
   * @param {string} redeemCode The redeem code.
   */
   async s2c_redeemPoints(redeemCode) {
    try {
      let ret = await this.requestApi('/points/redeem-code', 'POST', {
        code: redeemCode
      });
      await this.s2c_updatePoints();
      if (ret?.success) {
        this.helper.mainUI.showNotification(`You've get ${ret?.points} points.`, 5000);
      }
      return ret?.success;
    } catch (e) {
      console.error('Failed to redeem points: ', e);
      return false;
    }
  }

  /**
   * Notify other users to update the points.
   * @param uid User id
   */
  async notifyUpdatePoints(uid, message) {
    return await this.helper.callC2sAPI('point-system', 'notifyUpdatePoints', this.helper.defaultTimeout, uid, message);
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
      url: this.pointSystemAddress + endpoint,
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
