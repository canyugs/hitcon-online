// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';

/**
 * TODO: jsdoc
 */
class SingleNPC extends InteractiveObjectServerBaseClass {}

/**
 * TODO: jsdoc
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
    this.NPCs = new Map();

    // create individual NPC
    fs.readdirSync('../run/npc').forEach((file) => {
      const npc = new SingleNPC(helper, `../run/npc/${file}`);
      this.NPCs.set(file, npc);
    });
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
   * TODO
   * @param {Object} player - TODO
   * @param {String} npcName - TODO
   * @return {Object}
   */
  async c2s_getDisplayInfo(player, npcName) {
    const npc = this.NPCs.get(npcName);
    if (typeof npc === 'undefined') return {};
    return npc.getDisplayInfo();
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} npcName - TODO
   */
  async c2s_startInteraction(player, npcName) {
    const npc = this.NPCs.get(npcName);
    if (typeof npc === 'undefined') return;
    await npc.startInteraction(player);
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @return {Array}
   */
  async c2s_getListOfNPCs(player) {
    if (typeof this._NPCListCache === 'undefined') {
      this._NPCListCache = Array.from(this.NPCs.keys());
    }
    return this._NPCListCache;
  }
}

export default Standalone;
