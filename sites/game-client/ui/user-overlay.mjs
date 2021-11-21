// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from './overlay.mjs';

const USER_OVERLAY_DIV = 'user-overlay';

class UserOverlay extends Overlay {
    /**
   * @constructor
   * @param {MainUI} mainUI - The MainUI object.
   */
  constructor(mainUI) {
    const dom = document.getElementById(USER_OVERLAY_DIV);
    super(mainUI, dom);
  }

  show() {
    $(this.dom).show(); // TODO: correctly implementing the Overlay. i.e. add corresponding OverlayPosition
  }

  hide() {
    $(this.dom).hide();
  }

  canDismiss() {
      return false;
  }
}

export default UserOverlay;
