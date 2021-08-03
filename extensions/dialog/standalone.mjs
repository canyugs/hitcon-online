// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';

import {dirname} from 'path';
import {fileURLToPath} from 'url';
import path from 'path';

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
    this.npcInfo = {};
    this.npcObj = {};
  }

  /**
   * Initializes the extension, will get whole npc data from npc.json first.
   */
  async initialize() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filepath = path.join(__dirname, 'npc.json');
    this.npcObj = JSON.parse(await fs.promises.readFile(filepath, 'utf8'));
  }

  /**
   * Get the specific NPC data from Server (npc.json),
   * than send NPC data back to user to render the dialog.
   * @param {object} player - Player ID
   * @@param {object} arg - NPC name
   */
  async c2s_getSpecificNpcData(player, arg) {
    const npcName = arg['npc'];
    const npcObject = this.npcObj[npcName];

    if (npcObject == undefined) {
      assert.fail(`[Error] Does not have NPC ${npcName}'s data`);
    } else {
      arg = {
        'name': npcName,
        'sentence': npcObject.sentence,
        'choice': npcObject.choice,
      };

      if (npcObject.choice.length === 1) {
        await this.helper.callS2cAPI(player.playerID, 'dialog', 'singleChoiceDialog', 5000, arg);
      } else {
        await this.helper.callS2cAPI(player.playerID, 'dialog', 'multiChoiceDialog', 5000, arg);
      }
    }
  }

  /**
   * Get the user choice.
   * @param {object} player - Player ID
   * @param {object} arg - user choice
   */
  async c2s_getResultFromClient(player, arg) {
    console.log(arg);
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
