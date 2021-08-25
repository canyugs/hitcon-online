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
   * @param {Function} mapClickCallback - The function to be called when the user clicks on this interactive object.
   */
  constructor(helper, initialPosition, displayConfig, mapClickCallback) {
    this.helper = helper;
    this.mapCoord = initialPosition;
    this.displayConfig = displayConfig;

    for (const conf of displayConfig) {
      const {zIndex, layerName, renderFunction, renderArgs} = conf;
      this.helper.mapRenderer.registerCustomizedLayerToDraw(zIndex, layerName, renderFunction, renderArgs);
    }

    // TODO: register callback on map clicking
  }
}

export default InteractiveObjectClientBaseClass;
