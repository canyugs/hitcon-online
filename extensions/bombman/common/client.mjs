// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const LAYER_BOMB = {zIndex: 5, layerName: 'bombmanHasBomb'};
const LAYER_OBSTACLE = {zIndex: 1, layerName: 'bombmanObstacle'};
const LAYER_BOMB_EXPLODE = {zIndex: 3, layerName: 'bombmanBombExplode'};
const BOMB_COOLDOWN = 2000; // millisecond

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
    this.helper.inputManager.registerKeydownOnce(this.helper.mapRenderer.getInputEventDOM(), this.placeBomb.bind(this));

    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_OBSTACLE.zIndex, LAYER_OBSTACLE.layerName);
    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_BOMB.zIndex, LAYER_BOMB.layerName);
    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_BOMB_EXPLODE.zIndex, LAYER_BOMB_EXPLODE.layerName);

    // set cooldown
    this.cooldown = false; // TODO: cooldown Manager
  }

  /**
   * Callback function of map keydown.
   * Place a bomb if key is `keyboardMapping.place`.
   * @param {KeyboardEvent} event - the keydown event
   */
  async placeBomb(event) {
    if (event.key === keyboardMapping.place) {
      if (this.cooldown) return;
      // TODO: reduce latency using the same mechanism of player moving
      const success = await this.helper.callC2sAPI('bombman', 'placeBomb', this.helper.defaultTimeout, this.helper.gameClient.playerInfo.mapCoord);
      if (success) {
        // TODO: update player cool down
        this.cooldown = true;
        setTimeout(()=>{
          this.cooldown = false;
        }, BOMB_COOLDOWN);
      }
    }
  }
}

export default Client;

export {
  LAYER_BOMB,
  LAYER_OBSTACLE,
  LAYER_BOMB_EXPLODE,
  BOMB_COOLDOWN,
};
