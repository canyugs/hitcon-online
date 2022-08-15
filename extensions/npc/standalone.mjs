// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

/**
 * TODO: jsdoc
 */
class SingleNPC extends InteractiveObjectServerBaseClass { }

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
    fs.readdirSync(getRunPath('npc')).forEach((file) => {
      if (!file.toLowerCase().endsWith('.json')) {
        console.warn('Ignoring NPC file: ', file);
        return;
      }
      const npcName = file.slice(0, -('.json'.length));
      const npc = new SingleNPC(helper, npcName, getRunPath('npc', file));
      this.NPCs.set(npcName, npc);
    });
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    // allow NPC to call the state functions provided by other extensions
    await this.helper.callS2sAPI('iobj-lib', 'provideStateFunc', 'registerStateFuncToNPCs');
    await this.helper.callS2sAPI('items', 'provideStateFunc', 'registerStateFuncToNPCs');
    await this.helper.callS2sAPI('escape-game', 'provideStateFunc', 'registerStateFuncToNPCs');
    await this.helper.callS2sAPI('bombman', 'provideStateFunc', 'registerStateFuncToNPCs');
    await this.helper.callS2sAPI('battleroyale', 'provideStateFunc', 'registerStateFuncToNPCs');
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} npcName - TODO
   * @return {mapCoord}
   */
  async c2s_getClientInfo(player, npcName) {
    const npc = this.NPCs.get(npcName);
    if (typeof npc === 'undefined') {
      console.error(`In 'c2s_getClientInfo': NPC '${npcName}' not found.`);
      return null;
    }
    return npc.getClientInfo();
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @param {String} npcName - TODO
   */
  async c2s_startInteraction(player, npcName) {
    const npc = this.NPCs.get(npcName);
    if (typeof npc === 'undefined') {
      console.error(`In 'c2s_startInteraction': NPC '${npcName}' not found.`);
      return;
    }
    await npc.startInteraction(player.playerID);
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

  /**
   * Called by other extensions. Make their state functions available to the NPCs.
   */
  async s2s_registerStateFuncToNPCs(srcExt, fnNames) {
    for (const npc of this.NPCs.values()) {
      npc.registerExtStateFuncAll(srcExt, fnNames);
    }
  }
}

export default Standalone;
