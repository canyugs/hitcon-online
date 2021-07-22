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
  async c2s_broadcastMessage(player, args){
    args['msg_from'] = player.playerID;
    await this.helper.broadcastToAllUser(args);
  }

  /**
   * Send the chat message to specified player
   * @c2s_privateMessage
   * @param {Player} player - player information
   * @param {object} args - chat information including message, target player id
   */
  async c2s_privateMessage(player, args){
    args['msg_from'] = player.playerID;
    await this.helper.callS2cAPI(arg.msg_to, 'chat', 'getPrivateMessage', 5000, args);
    await this.helper.callS2cAPI(player.playerID, 'chat', 'sendedPrivateMessage', 5000, args);
  }

  /**
   * Teleport the player to the specified coordinate
   * @c2s_teleport
   * @param {Player} player - player information
   * @param {MapCoord} mapCoord - teleport information including map, x, y
   */
  async c2s_teleport(player, mapCoord){
    console.log('Teleport to ' + mapCoord.mapName + ' (' + mapCoord.x + ', '+ mapCoord.y + ')');
    await this.helper.teleport(player.playerID, mapCoord);
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
