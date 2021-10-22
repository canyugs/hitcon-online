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
    void helper;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  /**
   * Get the password of the specific
   * @param {Player} player - player information
   * @param {string} meetingName - the name of the requested meeting
   * @returns string
   */
  async c2s_getPassword(player, args) {
    // TODO: Authentication for jitsi is not implemented yet.
    console.log(`${player.playerID} and ${args} called on unimplemented c2s_getPassword()`);
    return '1234';
  }
}

export default Standalone;
