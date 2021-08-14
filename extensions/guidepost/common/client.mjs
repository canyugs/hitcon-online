// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause
import {MapCoord} from '/static/common/maplib/map.mjs';

const LAYER_GUIDEPOST = {zIndex: -10, layerName: "guidepost"};
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
   * Initialize the layer and send the guidepost data as a parameter from json file
   */
  async gameStart(){
    const guideposts = game.assetData = await $.ajax({url: "/static/run/map/watermark/guideposts.json", type: "GET",});
    guideposts.forEach((guidepost, index, guideposts) => {
      const image = new Image();
      image.assetName = guidepost.assetName;
      image.src = guidepost.src;
      guideposts[index].image = image;  
    });
    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_GUIDEPOST.zIndex, LAYER_GUIDEPOST.layerName, '_drawWatermark', guideposts);
  }

  /**
   * Returns true if this extension have a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} haveClient - See above.
   */
  static haveClient() {
    return false;
  }
};

export default Client;
