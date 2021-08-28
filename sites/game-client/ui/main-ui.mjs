// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import OverlayPosition from './overlay-position.mjs';

// enum
const UIState = Object.freeze({
  NORMAL_UI: Symbol(1),
  MODAL_SHOWN: Symbol(2),
});

const STAGING_ID = 'staging-div';
const MODAL_BG_ID = 'modal-background';
const MODAL_CONT_ID = 'modal-container';
const OVERLAY_DIV = new Map();
OVERLAY_DIV.set(OverlayPosition.LEFT_TOP, 'overlay-topleft');
OVERLAY_DIV.set(OverlayPosition.LEFT_BOTTOM, 'overlay-bottomleft');
OVERLAY_DIV.set(OverlayPosition.RIGHT, 'overlay-right');
OVERLAY_DIV.set(OverlayPosition.MAIN_VIEW, 'main-view');

const TOOLBAR_ID = 'toolbar';

/**
 * MainUI composes components into a window, 
 * components are classified into Notification, Toolbar, Overlay and Modal.
 */
class MainUI {
  /**
  * TODO(fanlan1210)
  * 
  * Create a MainUI.
  */
  constructor() {
    this.state = UIState.NORMAL_UI;
    this.overlays = new Map();
    this.activeModal = undefined;

    window.addEventListener('resize', (evt) => { this._onResize(evt); });
    window.addEventListener('gameStart', (evt) => { this._onResize(evt); });

    // Cache the common used DOM elements.
    this.stagingDom = document.getElementById(STAGING_ID);
    this.modalBgDom = document.getElementById(MODAL_BG_ID);
    this.modalContDom = document.getElementById(MODAL_CONT_ID);
    this.overlayDom = {};
    for (const [pos, div] of OVERLAY_DIV.entries()) {
      this.overlayDom[pos] = document.getElementById(div);
    }

    this.toolbarDom = document.getElementById(TOOLBAR_ID);
  }

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
   * @param target The element which wants add button, should be an Overlay or Modal.
   */
  addToolbarButton(target) {
    // WIP(fanlan1210)
    if (!target.hasToolbarButton()) return false;

    target.toolbarButton = document.createElement('button');
    // load icon asset into button
    const icon = new Image();
    icon.src = target.toolbarButtonSrc;

    target.toolbarButton.appendChild(icon);

    target.toolbarButton.addEventListener('click', () => {
      target.onClickToolbarButton();
    });
    this.toolbarDom.appendChild(target.toolbarButton);
  }

  /**
   * Remove an button from the Toolbar.
   * @param target The element which wants remove button, should be an Overlay or Modal.
   */
  removeToolbarButton(target) {
    // WIP(fanlan1210)
    this.toolbarDom.removeChild(target.toolbarButton);
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
   * Enable the modal UI.
   * i.e. Display the backdrop (#model-background) and container
   * (#model-container).
   */
  _enableModal() {
    this.state = UIState.MODAL_SHOWN;
    this.modalBgDom.classList.add('visible');
    this.modalContDom.classList.add('visible');
  }

  /**
   * Disable the modal UI.
   * i.e. Remove the backdrop and hide the container.
   */
  _disableModal() {
    this.state = UIState.NORMAL_UI;
    this.modalBgDom.classList.remove('visible');
    this.modalContDom.classList.remove('visible');
  }

  /**
   * Reset all elements of the modal container into the staging container.
   */
  _evictModalContainer() {
    // We look at children and not childNode because we only care about
    // the DOM elements. We do not place text or other stuff in the modal
    // container.
    for (const ele of this.modalContDom.children) {
      this._restoreToStaging(ele);
    }
    this.modalContDom.innerHTML = '';
  }

  /**
   * This is called by the Modal class to set the modal class as the current
   * active modal.
   */
  _setModal(modal) {
    if (this.activeModal !== undefined) {
      // TODO: Maybe support having a stack of to be activated modals?
      console.warn('We do not currently support multiple active modals');
      return false;
    }

    this._evictModalContainer();
    this._enableModal();
    this.activeModal = modal;
    for (const ele of modal._getModalDOM()) {
      this.modalContDom.append(ele);
    }
    return true;
  }

  /**
   * This is called by the Modal class to remove itself as the active modal.
   */
  _clearModal(modal) {
    if (this.activeModal !== modal) {
      throw 'Incorrect modal trying to call _clearModal()';
      return false;
    }
    this.activeModal = undefined;
    this._evictModalContainer();
    this._disableModal();
    return true;
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
