// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

class IframeOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById('iframe-overlay');
    super(mainUI, dom);
    this.iframe = dom.querySelector('iframe');
    this.hide();
    this.lastSrc = null;

    const expandBtn  = document.getElementById('iframe-expand');
    expandBtn.onclick = () => {
      mainUI.enterFocusMode(this, OverlayPosition.LEFT_BOTTOM);
    };
  }

  updateIframe(src) {
    if (src === null || src === undefined || src === '') {
      // These 3 should be treated the same.
      src = null;
    }

    if (this.lastSrc === src) return;
    if (src === null) {
      this.hide();
      this.lastSrc = null;
      this.iframe.src = '';
      return;
    }

    this.iframe.src = src;
    this.lastSrc = src;
    if (!this.isOpen) {
      this.show(OverlayPosition.LEFT_BOTTOM);
      return;
    }
  }
}

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
    this.overlay = undefined;
  }

  async gameStart() {
    this.overlay = new IframeOverlay(this.helper.mainUI);
  }

  onSelfPlayerUpdate(msg) {
    const map = this.helper.getMap();
    if (typeof map === 'object') {
      let src = undefined;
      try {
        src = map.getCell(msg.mapCoord, 'videoIframe');
      } catch (e) {
        console.log("Failed to get videoIframe", e);
      }
      if (typeof src !== 'undefined' && typeof this.overlay === 'object') {
        this.overlay.updateIframe(src);
      }
    }
  }
}

export default Client;
