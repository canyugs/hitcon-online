// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class InteractiveObjectClientBaseClass {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   * @param {Object} displayConfig - TODO
   * @param {Function} mapClickCallback - The function to be called when the user clicks on this interactive object.
   */
  constructor(helper, displayConfig, mapClickCallback) {
    this.helper = helper;
    this.displayConfig = displayConfig;

    // TODO: MapRenderer.registerCustomizedLayerToDraw()
    // TODO: register callback on map clicking
  }
}

export default InteractiveObjectClientBaseClass;
