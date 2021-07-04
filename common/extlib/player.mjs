// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * Player is a utility object for extension to operate a player.
 */
class Player {
  /**
   * Create the player object.
   * @constructor
   */
  constructor(playerID) {
    this.playerID = playerID;
  }

  /**
   * Return the player's ID.
   * @return {string} playerID
   */
  getPlayerID() {
    return this.playerID;
  }

  /**
   * Teleport the user.
   * @param {Number} x - The target x coordinate.
   * @param {Number} y - The target y coordinate.
   */
  async teleport(x, y) {
    assert.fail('Not implemented');
  }

  /**
   * Pop up a dialog on the user.
   * This only returns when the user resolves (clicks OK) on the
   * dialog.
   * @param {String} message - Message to show to the user.
   */
  async dialog(message) {
    assert.fail('Not implemented');
  }

  /**
   * Pop up a dialog on the user.
   * This only returns when the user resolves (clicks an option) on
   * the dialog.
   * Example:
   * let result = await dialogChoice('What's your faviourite fruit?', [
   *     [1, 'Apple'],
   *     [2, 'Banana'],
   *     [3, 'Watermelon']
   *  ]);
   * // User clicks on 'Banana', result = 2.
   * @param {String} message - Message to show to the user.
   * @param {object} choices - An array of array that represents the
   * choices to show the users. Each element of the array is an array
   * with two elements. The first is the identifier to return if the user
   * selects the choice. The second is the text shown to the user.
   */
  async dialogChoice(message, choices) {
    assert.fail('Not implemented');
  }

  /**
   * Call an API on the client side of the extension.
   * @param {String} extensionName - The name of the extension. Leave empty
   * for current extension.
   * @param {String} methodName - The name of the method.
   * @param {object} args - The arugements to the API.
   * @param {Number} timeoutMs - The timeout in ms.
   * @return {object} result - The result from the call.
   */
  async callAPI(extensionName, methodName, args, timeoutMs) {
    assert.fail('Not impemented');
  }
};

export default Player;
