// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import OverlayPosition from './overlay-position.mjs';

// enum
const UIState = Object.freeze({
  NORMAL_UI: Symbol(1),
  MODAL_SHOWN: Symbol(2),
});

const STAGING_ID = 'staging-div';
const OVERLAY_DIV = new Map();
OVERLAY_DIV.set(OverlayPosition.LEFT_TOP, 'overlay-topleft');
OVERLAY_DIV.set(OverlayPosition.LEFT_BOTTOM, 'overlay-bottomleft');
OVERLAY_DIV.set(OverlayPosition.RIGHT, 'overlay-right');
OVERLAY_DIV.set(OverlayPosition.MAIN_VIEW, 'main-view');

/**
 * TODO(fanlan1210)
 */
class MainUI {
  /**
  * TODO(fanlan1210)
  */
  constructor() {
    this.state = UIState.NORMAL_UI;
    this.overlays = new Map();

    window.addEventListener('resize', (evt) => { this._onResize(evt); });
    window.addEventListener('load', (evt) => { this._onResize(evt); });

    // Cache the common used DOM elements.
    this.stagingDom = document.getElementById(STAGING_ID);
    this.overlayDom = {};
    for (const [pos, div] of OVERLAY_DIV.entries()) {
      this.overlayDom[pos] = document.getElementById(div);
    }
  }

  /**
   * Return Modal class. It can called by extension.
   * 
   * When having multiple modals want to show, it should stacked by priority.
   * @param modal one of Modal.
   */
  showModal(modal) {}

  /**
   *  Return one of UIState.
   */ 
  getState() {}

  /**
   * set what MainView should display.
   * @param {Overlay} overlay one of Overlay.
   */
  setMainView(overlay) {}

  // Toolbar buttons including overlay hide/show.
  /**
   * Add an button in the Toolbar. Default visibility determined by the target, 
   * and the button icon should get from the target.
   * 
   * @param target The element which wants add button, should be an Overlay or Modal.
   */
  addToolbarButton(target) {
    // TODO(fanlan1210)
  }

  /**
   * Remove an button from the Toolbar.
   * 
   * @param target The element which wants remove button, should be an Overlay or Modal.
   */
  removeToolbarButton(target) {
    // TODO(fanlan1210)
  }

  // TODO: Stack visualization? Stack height limit?
  /**
   * Show notification in notification area.
   * @param msg The message want to be shown.
   * @param {Number} timeout The duraion of showing notification, the unit is millisecond.
   */
  showNotification(msg, timeout) {
    // TODO(lisasasasa)
  }

  // If we want to use individual overlay for meeting
  // position = 0...n
  // setTopbarOverlay(position, overlay);
  // count=0 for no topbar.
  // resizeTopbarOverlay(count);

  // ========== Internal Methods ============
  // Methods below should only be used by UI classes such as Model/Overlay.

  /**
   * Send a DOM element back into staging area.
   */
  _restoreToStaging(dom) {
    this.stagingDom.appendChild(dom);
  }

  /**
   * set Overlay at the position.
   * @param {OverlayPosition} position one of OverlayPosition.
   */
  _setOverlay(position, overlay) {
    // If there's anything in the target, clear it out.
    if (this.overlays.has(position)) {
      if (!this.overlays.get(position).hide()) return false;
    }

    this.overlays.set(position, overlay);
    const container = this.overlayDom[position];
    container.appendChild(overlay.dom);
    return true;
  }

  /**
   * Removes the overlay at position.
   */
  _clearOverlay(position, overlay) {
    if (!this.overlays.has(position)) {
      // Already cleared.
      return true;
    }

    if (this.overlays.get(position) !== overlay) {
      // This is not the overlay.
      console.assert(false, `Overlay at position ${position} mismatch, got ` +
        `${this.overlays.get(position)} and ${overlay}`);
      return false;
    }
    this._restoreToStaging(overlay.dom);
    this.overlays.delete(position);
    return true;
  }

  /**
   * This is called whenever the window is resized.
   * @private
   */
  _onResize(event) {
    for (const overlay of this.overlays.values()) {
      overlay.onResize(event);
    }
  }
}

export default MainUI;
