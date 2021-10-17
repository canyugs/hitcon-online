// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

/**
 * TODO: jsdoc
 */
class InteractiveObjectClientBaseClass {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   * @param {MapCoord} initialPosition - TODO
   * @param {Object} clientInfo - Information regrading this interactive object
   *   that the client side should know. It should contain:
   *   - {MapCoord} initialPosition - NPC's initial position.
   *   - {Object} displayConfig - Arguments for drawing this NPC.
   * @param {Function} interactFunction - The function to be called when the user tries to
   * interact with this object (on click, keydown, signal, etc.)
   */
  constructor(helper, clientInfo, interactFunction) {
    this.helper = helper;
    this.clientInfo = clientInfo;
    this.mapCoord = clientInfo.initialPosition;
    this.displayConfig = clientInfo.displayConfig;

    for (const conf of this.displayConfig) {
      const {zIndex, layerName, renderFunction, renderArgs} = conf;
      this.helper.mapRenderer.registerCustomizedLayerToDraw(zIndex, layerName, renderFunction, renderArgs);
    }

    // interact on click
    // TODO: use `class InteractiveObjectManager` to handle the callback.
    // `InteractiveObjectManager.lookupTable` is a Map() whose key and value are coordinate and callback, respectively.
    // In this way, there will be only one callback in InputManager and InteractiveObjectManager will find the
    // respective callback in O(1) complexity.
    this.helper.inputManager.registerCanvasOnClickMapCoord((clickedMapCoord) => {
      // determine whether this object is clicked
      const {x: cx, y: cy} = clickedMapCoord;
      const {x, y} = this.mapCoord;
      if (!(x <= cx && cx < x+1 && y <= cy && cy < y+1)) return;

      // TODO: check whether the player can interact with this object (e.g. too far to interact)
      // const playerPosition = this.helper.gameClient.playerData.mapCoord;
      // if (distance(clickedMapCoord, playerPosition) >= ???) return;
      interactFunction();
    });

    // TODO: interact on keydown
  }
}

export default InteractiveObjectClientBaseClass;
