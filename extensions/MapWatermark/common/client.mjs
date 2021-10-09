// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause
import {MapCoord} from '/static/common/maplib/map.mjs';

const LAYER_MAPWATERMARK = {zIndex: -10, layerName: "MapWatermark"};
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
   * Initialize the layer and send the watermark data as a parameter from json file
   */
  async gameStart() {
    const mapWatermarks = await $.ajax({url: "/static/run/map/watermark/MapWatermarks.json", type: "GET"});
    const arr_promise = [];

    mapWatermarks.forEach((mapWatermark, index, mapWatermarks) => {
      arr_promise.push(new Promise((resolve, reject) => {
        const image = new Image();
        image.assetName = mapWatermark.assetName;
        image.src = mapWatermark.src;
        image.onload = resolve;
        image.onerror = () => {
          reject(`error on loading ${image.src}`);
        }
        mapWatermarks[index].image = image;  
      }));
    });

    await Promise.all(arr_promise).then(() => {
      this.helper.mapRenderer.registerCustomizedLayerToDraw(
        LAYER_MAPWATERMARK.zIndex, 
        LAYER_MAPWATERMARK.layerName, 
        '_drawWatermark', 
        mapWatermarks
      );
    }).catch((err_msg) => {
      console.error('Failed to initialize watermark: ', err_msg);
    });
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
