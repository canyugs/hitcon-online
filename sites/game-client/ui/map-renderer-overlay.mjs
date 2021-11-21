// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MAP_CELL_SIZE} from '/static/sites/game-client/map-renderer.mjs';
import Overlay from './overlay.mjs';

const MAP_RENDERER_DIV = 'maprender-overlay';

class MapRendererOverlay extends Overlay {
  /**
   * @constructor
   * @param {MainUI} mainUI - The MainUI object.
   */
  constructor(mainUI) {
    const dom = document.getElementById(MAP_RENDERER_DIV);
    super(mainUI, dom);
    this.canvas = document.querySelector('#mapcanvas');
    this.inputCanvas = document.querySelector('#inputcanvas');
  }

  /**
   * The callback function of window resize and game start.
   */
  onResize() {
    const widthCount = Math.floor(this.dom.clientWidth / MAP_CELL_SIZE) + 1;
    const heightCount = Math.floor(this.dom.clientHeight / MAP_CELL_SIZE) + 1;

    this.canvas.height = this.inputCanvas.height = MAP_CELL_SIZE * heightCount;
    this.canvas.width = this.inputCanvas.width = MAP_CELL_SIZE * widthCount;
  }
};

export default MapRendererOverlay;
