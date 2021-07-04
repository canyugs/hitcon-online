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

  async c2s_broadcastMessage(player, arg){
    // TODO: Check whether message is command like /help
    arg['msg_from'] = player.playerID;
    await this.helper.broadcastToAllUser(arg);
  }

  async c2s_privateMessage(player, arg){
    arg['msg_from'] = player.playerID;
    await this.helper.callS2cAPI(arg.msg_to, 'chat', 'getPrivateMessage', 5000, arg);
    await this.helper.callS2cAPI(player.playerID, 'chat', 'sendedPrivateMessage', 5000, arg);
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
