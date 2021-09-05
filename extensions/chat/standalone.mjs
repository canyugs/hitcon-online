// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

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
   * Broadcast the chat message to all players
   * @c2s_broadcastMessage
   * @param {Player} player - player information
   * @param {object} args - chat information including message
   */
  async c2s_broadcastMessage(player, args) {
    args['msg_from'] = player.playerID;
    await this.helper.broadcastToAllUser(args);
  }

  /**
   * Check every player's position and send message to them if they are nearby the sender
   * @c2s_nearbyMessage
   * @param {Player} player - player information
   * @param {object} args - nearby message including msg
   */
  async c2s_nearbyMessage(player, args) {
    const centerPlayerCoord = [...this.helper.gameState.getPlayers().entries()]
      .filter((entry) => entry[0] === player.playerID)
      .map((k) => k)[0][1]
      .mapCoord;
    if (!centerPlayerCoord) {
      console.error('Cannot find target player id');
      return;
    }

    args['msg_from'] = player.playerID;
    this.helper.gameState.players.forEach(async (value, key, map) => {
      // TODO(zeze-zeze): Check the definition of "nearby". Now is equal to or less than two blocks in x, y coordinates.
      if (Math.abs(value.mapCoord.x - centerPlayerCoord.x) <= 2 && Math.abs(value.mapCoord.y - centerPlayerCoord.y) <= 2) {
        await this.helper.callS2cAPI(value.playerID, 'chat', 'getNearbyMessage', 5000, args);
      }
    });
  }

  /**
   * Send the chat message to specified player
   * @c2s_privateMessage
   * @param {Player} player - player information
   * @param {object} args - chat information including message, target player id
   */
  async c2s_privateMessage(player, args) {
    args['msg_from'] = player.playerID;
    await this.helper.callS2cAPI(args.msg_to, 'chat', 'getPrivateMessage', 5000, args);
    await this.helper.callS2cAPI(player.playerID, 'chat', 'sendedPrivateMessage', 5000, args);
  }

  /**
   * Teleport the player to the specified coordinate
   * @c2s_teleport
   * @param {Player} player - player information
   * @param {MapCoord} mapCoord - teleport information including map, x, y
   */
  async c2s_teleport(player, mapCoord) {
    console.log('Teleport to ' + mapCoord.mapName + ' (' + parseInt(mapCoord.x, 10) + ', '+ parseInt(mapCoord.y, 10) + ')');
    console.log(await this.helper.teleport(player.playerID, mapCoord));
  }

  /**
   * Handle commands that only admin can use
   * @c2s_otherCommands
   * @param {string} cmd - command input by user
   * @return {object} result - the result of admin command, state will be false if command not found
   */
  async c2s_otherCommands(cmd) {
    const result = {'state': false, 'reply': ''};
    return result;
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }
}

export default Standalone;
