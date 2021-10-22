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
   * This function is not used in production and is only an example to
   * demonstrate the usage of dialog APIs.
   *
   * No argument is required, simply call this with the following in the
   * client's console:
   * game.extMan.callC2sAPI('dialog', 'example1', 10*60*1000).then(
   *   () => {console.log('Dialog example finished')});
   */
  async c2s_example1(player, arg) {
    console.log('Showing a simple dialog:');
    let res = await this.helper.callS2cAPI(player.playerID, 'dialog',
      'showDialog', 60*1000, 'Hello', 'How are you?');
    console.log(`Simple dialog result: ${JSON.stringify(res)}`);

    console.log('Showing a multichoice dialog:');
    res = await this.helper.callS2cAPI(player.playerID, 'dialog',
      'showDialogWithMultichoice', 60*1000,
      'What\'s your favourite color?',
      'Pick a color:',
      [
        {token: 'r', display: "Red!"},
        {token: 'b', display: "Blue~"},
        {token: 'g', display: "Green."}
      ]);
    console.log(`Multichoice dialog result: ${JSON.stringify(res)}`);

    console.log('Showing a prompt dialog:');
    res = await this.helper.callS2cAPI(player.playerID, 'dialog',
      'showDialogWithPrompt', 60*1000, 'Wassup', 'What are you thinking?');
    console.log(`Simple prompt result: ${JSON.stringify(res)}`);
  }

  /**
   * Get the specific NPC data from Server (npc.json),
   * than send NPC data back to user to render the dialog.
   * @param {object} player - Player ID
   * @@param {object} arg - NPC name
   */
  async c2s_getSpecificNpcData(player, arg) {
    const npcName = arg['npc'] ;
    const npcObject = this.npcObj[npcName];

    if (npcObject == undefined) {
      assert.fail(`[Error] Does not have NPC ${npcName}'s data`);
    } else {
      arg = {
        'name': npcName,
        'sentence': npcObject.sentence,
        'choice': npcObject.choice
      };

      if (npcObject.choice.length === 1) {
        await this.helper.callS2cAPI(player.playerID, 'dialog', 'singleChoiceDialog', 5000, arg);
      } else {
        await this.helper.callS2cAPI(player.playerID, 'dialog', 'multiChoiceDialog', 5000, arg);
      }
    }
  }
}

export default Standalone;
