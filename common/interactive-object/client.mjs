// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
   * @param {Object} displayConfig - TODO
   * @param {Function} interactFunction - The function to be called when the user tries to
   * interact with this object (on click, keydown, signal, etc.)
   */
  constructor(helper, initialPosition, displayConfig, interactFunction) {
    this.helper = helper;
    this.mapCoord = initialPosition;
    this.displayConfig = displayConfig;

    for (const conf of displayConfig) {
      const {zIndex, layerName, renderFunction, renderArgs} = conf;
      this.helper.mapRenderer.registerCustomizedLayerToDraw(zIndex, layerName, renderFunction, renderArgs);
    }

    // interact on click
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
