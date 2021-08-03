// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from './overlay.mjs';

const MAP_RENDERER_DIV = 'map-render-overlay';

class MapRendererOverlay extends Overlay {
  /**
   * @constructor
   * @param {MainUI} mainUI - The MainUI object.
   */
  constructor(mainUI) {
    const dom = document.getElementById(MAP_RENDERER_DIV);
    super(mainUI, dom);
    this.canvas = document.querySelector('#mapcanvas');
  }

  /**
   * The callback function of window resize and game start.
   * @param {UIEvent} event
   */
  onResize(event) {
    // TODO: more detailed tweak
    this.canvas.height = 32 * 15; // 15 tiles
    this.canvas.width = 32 * 20; // 20 tiles
  }
}

export default MapRendererOverlay;
