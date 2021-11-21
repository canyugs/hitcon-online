// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';
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
   * @param {Object} clientInfo - The client side info for the NPC.
   */
  constructor(helper, npcName, clientInfo) {
    const mapCoord = MapCoord.fromObject(clientInfo.initialPosition);
    clientInfo.mapCoord = mapCoord;
    const facing = 'D';

    for (const cfg of clientInfo.displayConfig) {
      if (cfg.layerName === 'npcImage') {
        cfg.renderArgs = {
          mapCoord: mapCoord,
          displayChar: cfg.character,
          facing: facing,
          getDrawInfo() {
            return {mapCoord: this.mapCoord, displayChar: this.displayChar, facing: this.facing};
          },
        };
      } else if (cfg.layerName === 'npcName') {
        cfg.renderArgs = {
          mapCoord: mapCoord,
          displayName: clientInfo.visibleName,
          getDrawInfo() {
            return {mapCoord: this.mapCoord, displayName: this.displayName};
          },
        };
      }
    }

    const interactFunction = () => {
      helper.callC2sAPI('npc', 'startInteraction', this.helper.defaultTimeout, npcName);
    };

    super(helper, clientInfo, interactFunction);
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
      const clientInfo = await this.helper.callC2sAPI('npc', 'getClientInfo', this.helper.defaultTimeout, npcName);
      const npc = new SingleNPC(this.helper, npcName, clientInfo);
      this.NPCs.set(npcName, npc);
    }
  }

  onSelfPlayerUpdate(msg) {
    if (typeof msg.mapCoord !== 'object') {
      console.warn(`Invalid mapCoord in npc.onSelfPlayerUpdate: `, msg);
      return;
    }

    if (typeof this.NPCs === 'object') {
      const NPC_HINT_DIST = 2;
      for (const npc of this.NPCs) {
        if (msg.mapCoord.distanceTo1(npc[1].mapCoord) <= (npc[1].distanceLimit ?
            Math.min(npc[1].distanceLimit, NPC_HINT_DIST) : NPC_HINT_DIST)) {
          this.helper.mainUI.showNPCHint(npc[1].npcName);
          return
        }
      }
    }
    this.helper.mainUI.showNPCHint(null);
  }
  /**
   * TODO
   * @return {Array}
   */
  async getListOfNPCs() {
    return await this.helper.callC2sAPI('npc', 'getListOfNPCs', this.helper.defaultTimeout);
  }
}

export default Client;
