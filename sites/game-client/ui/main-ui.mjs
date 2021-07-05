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
  showModal(modal) {}

  /**
   *  Return one of UIState.
   */ 
  getState() {}

  /**
   *  @param {OverlayPosition} position one of OverlayPosition.
   */
  setOverlay(position, overlay) {}
  
  /**
   * set what MainView should display.
   * @param {Overlay} overlay 
   */
  setMainView(overlay) {}

  // Toolbar buttons including overlay hide/show.
  addToolbarButton()
  removeToolbarButton()

  // TODO: Stack visualization? Stack height limit?
  /**
   * Show notification in notification area.
   * @param msg 
   * @param {Number} timeout 
   */
  showNotification(msg, timeout);

  // If we want to use individual overlay for meeting
  // position = 0...n
  // setTopbarOverlay(position, overlay);
  // count=0 for no topbar.
  // resizeTopbarOverlay(count);
}

export default MainUI;