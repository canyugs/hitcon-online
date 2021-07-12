// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// enum
const UIState = Object.freeze({
  NORMAL_UI: Symbol(1),
  MODAL_SHOWN: Symbol(2),
});

class MainUI {
  constructor() {
  }

  // Return Modal class.
  // Called by extension.
  /**
   * When having multiple modals want to show, it should stacked by priority.
   * @param modal one of Modal.
   */
  showModal(modal) {}

  /**
   *  Return one of UIState.
   */ 
  getState() {}

  /**
   * set Overlay position.
   * @param {OverlayPosition} position one of OverlayPosition.
   */
  setOverlay(position, overlay) {}
  
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
  addToolbarButton(target)

  /**
   * Remove an button from the Toolbar.
   * 
   * @param target The element which wants remove button, should be an Overlay or Modal.
   */
  removeToolbarButton(target)

  // TODO: Stack visualization? Stack height limit?
  /**
   * Show notification in notification area.
   * @param msg The message want to be shown.
   * @param {Number} timeout The duraion of showing notification, the unit is millisecond.
   */
  showNotification(msg, timeout);

  // If we want to use individual overlay for meeting
  // position = 0...n
  // setTopbarOverlay(position, overlay);
  // count=0 for no topbar.
  // resizeTopbarOverlay(count);
}

export default MainUI;