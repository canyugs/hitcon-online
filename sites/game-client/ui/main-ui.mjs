// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Modal {
  constructor() {}

  // Modal size? Modal position?

  // If true, user can dismiss the modal.
  canDismiss() {}
  
  showToolbarButton() {}

  // Return root dom element.
  getDOM() {}

  // Unset visibility=hidden or display=none and update MainUI.
  show() {}

  // Set visibility=hidden or display=none and update MainUI.
  dismiss() {}

  // onDismiss(), onShow()
}

// enum
class UIState {
  static NORMAL_UI() { return 1; }
  static MODAL_SHOWN() { return 2; }
}

// Represents an overlay
class Overlay {
  constructor(dom) {}

  // Overlay hide/show related properties.
  canHide() {}
  canDismiss() {}
  showToolbarButton() {}

  /*
  -> HIDDEN -> SHOW -+
     |  ^-------|    |
     +---------------+
     V
  DISMISSED
  */

  // HIDDEN -> SHOW
  show();
  
  // SHOW -> HIDE
  hide();
  
  // SHOW/HIDDEN -> DISMISS
  dismiss();

  // onDismiss(), onShow(), onHide()
};

class OverlayPosition {
  static LEFT_BOTTOM();
  static RIGHT();
};

class MainUI {
  constructor() {
  }

  // Return Modal class.
  // Called by extension.
  showModal(modal) {}

  // Return one of UIState.
  getState() {}

  // position = one of OverlayPosition.
  setOverlay(position, overlay) {}
  setMainView(overlay) {}

  // Toolbar buttons excluding overlay hide/show.
  addToolbarButton()

  // Show notification in notification area.
  // TODO: Stack visualization? Stack height limit?
  showNotification(msg, timeout);

  // If we want to use individual overlay for meeting
  // position = 0...n
  // setTopbarOverlay(position, overlay);
  // count=0 for no topbar.
  // resizeTopbarOverlay(count);
}
