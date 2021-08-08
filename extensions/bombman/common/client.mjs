// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const LAYER_BOMB = {zIndex: 5, layerName: 'bombmanHasBomb'};
const LAYER_OBSTACLE = {zIndex: 1, layerName: 'bombmanObstacle'};

const keyboardMapping = {
  place: ' ',
};

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
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
  }

  /**
   * The initialization function.
   */
  async gameStart() {
    this.helper.inputManager.registerKeydown(this.helper.mapRenderer.getCanvas(), this.placeBomb.bind(this));
    // TODO: player cool down

    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_OBSTACLE.zIndex, LAYER_OBSTACLE.layerName);
    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_BOMB.zIndex, LAYER_BOMB.layerName);
  }

  /**
   * Callback function of map keydown.
   * Place a bomb if key is `keyboardMapping.place`.
   * @param {KeyboardEvent} event - the keydown event
   */
  async placeBomb(event) {
    if (event.key === keyboardMapping.place) {
      // TODO: reduce latency using the same mechanism of player moving
      const success = await this.helper.callC2sAPI('bombman', 'placeBomb', 500, this.helper.gameClient.playerInfo.mapCoord);
      if (success) {
        // TODO: update player cool down
      }
    }
  }
}

export default Client;

export {
  LAYER_BOMB,
  LAYER_OBSTACLE,
};
