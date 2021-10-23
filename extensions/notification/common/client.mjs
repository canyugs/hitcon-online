// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// NOTE: This extension is used simply to make it easier to show notification
// from the server side.

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

  /**
   * Show notification.
   * 
   * @param {String} message - The message to show.
   * @param {Number} timeout - The timeout in ms, should be an integer. If not an integer we'll use the default time.
   * 
   * Note: This function returns immediately without waiting for the notification to disappear.
   */
  async s2c_showNotification(message, timeout) {
    this.helper.mainUI.showNotification(message, timeout);
    return true;
  }

  /**
   * Show announcement.
   * 
   * @param {String} message - The message to show.
   * @param {Number} timeout - The timeout in ms, should be an integer. If not an integer we'll use the default time.
   * 
   * Note: This function returns immediately without waiting for the announcement to disappear.
   */
  async s2c_showAnnouncement(message, timeout) {
    this.helper.mainUI.showAnnouncement(message, timeout);
    return true;
  }

  /**
   * Returns true if this extension has a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} hasClient - See above.
   */
  static hasClient() {
    return true;
  }
};

export default Client;
