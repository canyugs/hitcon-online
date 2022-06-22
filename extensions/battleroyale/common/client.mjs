// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const LAYER_OBSTACLE = {zIndex: 1, layerName: 'battleroyaleObstacle'};
const LAYER_BULLET = {zIndex: 5, layerName: 'battleroyaleBullet'};
const BULLET_COOLDOWN = 2000; // millisecond

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
    this.helper.inputManager.registerKeydownOnce(this.helper.mapRenderer.getInputEventDOM(), this.attack.bind(this));

    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_OBSTACLE.zIndex, LAYER_OBSTACLE.layerName);
    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_BULLET.zIndex, LAYER_BULLET.layerName);

    // set cooldown
    this.cooldown = false;
  }

  /**
   * Callback function of map keydown.
   * Place a bomb if key is `keyboardMapping.place`.
   * @param {KeyboardEvent} event - the keydown event
   */
  async attack(event) {
    if (event.key === keyboardMapping.place) {
      if (this.cooldown) return;

      const success = await this.helper.callC2sAPI(
          'battleroyale',
          'attack',
          this.helper.defaultTimeout,
          this.helper.gameClient.playerInfo.mapCoord,
          this.helper.gameClient.playerInfo.facing,
      );

      if (success) {
        this.cooldown = true;
        setTimeout(()=>{
          this.cooldown = false;
        }, BULLET_COOLDOWN);
      }
    }
  }
}

export default Client;

export {
  LAYER_OBSTACLE,
  LAYER_BULLET,
  BULLET_COOLDOWN,
};
