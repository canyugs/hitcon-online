// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import InteractiveObjectClientBaseClass from '/static/common/interactive-object/client.mjs';

// const LAYER_NPC = {zIndex: 9, layerName: 'NPC'}

// /**
//  * This class is the browser/client side of an extension.
//  * One instance is created for each connected player.
//  */
// class Client {
//   /**
//    * Create the client side of the extension.
//    * @constructor
//    * @param {ClientExtensionHelper} helper - An extension helper object for
//    * servicing various functionalities of the extension.
//    */
//   constructor(helper) {
//     this.helper = helper;

//     // Force `this.NPCs` to be const so that mapRenderer will always access the identical list of NPCs.
//     // The format of `this.NPCs` is similar to `GameState.players`.
//     Object.defineProperty(this, 'NPCs', {
//       value: {},
//       writable: false,
//       configurable: false,
//     });
//   }

//   /**
//    * The initialization function.
//    */
//   async gameStart() {
//     this.helper.mapRenderer.registerCustomizedLayerToDraw(
//       LAYER_NPC.zIndex,
//       LAYER_NPC.layerName,
//       '_drawCharacters',
//       this.NPCs,
//     );
//   }
// }

/**
 * TODO: jsdoc
 */
class SingleNPC extends InteractiveObjectClientBaseClass {
  /**
   * TODO
   * @param {ClientExtensionHelper} helper - The extension helper.
   * @param {String} npcName - The name of the NPC.
   * @param {Object} displayConfig - TODO
   * @param {Function} mapClickCallback - TODO
   */
  constructor(helper, npcName, displayConfig, mapClickCallback) {
    super(helper, displayConfig, mapClickCallback);
    this.npcName = npcName;
  }
}

/**
 * TODO: jsdoc
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
    this.NPCs = new Map();
  }

  /**
   * The initialization function.
   */
  async gameStart() {
    const listOfNPCs = await this.getListOfNPCs();
    for (const npcName of listOfNPCs) {
      const displayConfig = await this.helper.callC2sAPI('npc', 'getDisplayInfo', 500, npcName);
      const mapClickCallback = (npcName) => {
        this.helper.callC2sAPI('npc', 'startInteraction', 500, npcName);
      };
      const npc = new SingleNPC(this.helper, npcName, displayConfig, mapClickCallback.bind(this, npcName));
      this.NPCs.set(npcName, npc);
    }
  }

  /**
   * TODO
   * @return {Array}
   */
  async getListOfNPCs() {
    return await this.helper.callC2sAPI('npc', 'getListOfNPCs', 500);
  }
}

export default Client;
