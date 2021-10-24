// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

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
    fs.readdirSync(getRunPath('npc')).forEach((file) => {
      const npcName = file.slice(0, -('.json'.length));
      const npc = new SingleNPC(helper, npcName, getRunPath('npc', file));
      this.NPCs.set(npcName, npc);
    });
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    await this.helper.callS2sAPI('iobj-lib', 'reqRegister');
    await this.helper.callS2sAPI('items', 'reqRegister');
    await this.helper.callS2sAPI('escape-game', 'reqRegister');
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
   * Allow other ext to add state func.
   */
  async s2s_registerStateFunc(srcExt, fnName, extName, methodName) {
    this.NPCs.forEach((v) => {
      v.registerExtStateFunc(fnName, extName, methodName);
    });
  }
}

export default Standalone;
