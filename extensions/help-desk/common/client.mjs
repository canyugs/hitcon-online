// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import Modal from '/static/sites/game-client/ui/modal.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const HELP_DESK_OVERLAY = 'help-desk-overlay';
const HELP_DESK_ENTRY = 'help-desk-entry';
const HELP_DESK_MENU = 'help-desk-menu';
const HELP_DESK_SERVICE = 'help-desk--service';
const HELP_DESK_REPORT = 'help-desk--report';
const HELP_DESK_MODAL = 'help-desk-modal';
const HELP_DESK_MODAL_CANCEL = 'help-desk-modal-cancel';
const HELP_DESK_MODAL_CONFIRM = 'help-desk-modal-confirm';

class HelpDeskOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(HELP_DESK_OVERLAY);
    super(mainUI, dom);
    this.show(OverlayPosition.RIGHT);
    this.menu = document.getElementById(HELP_DESK_MENU);
  }

  toggleMenu() {
    this.menu.classList.toggle('visible');
  }
}

class HelpDeskModal extends Modal {
  constructor(mainUI) {
    const dom = document.getElementById(HELP_DESK_MODAL);
    super(mainUI, dom);

    this.cancelButton = document.getElementById(HELP_DESK_MODAL_CANCEL);
    this.cancelButton.addEventListener('click', () => {
      this.hide();
    });

    this.confirmButton = document.getElementById(HELP_DESK_MODAL_CONFIRM);
  }

  canDismiss() {
    return true;
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
    this.modal = undefined;
  }

  async gameStart() {
    this.overlay = new HelpDeskOverlay(this.helper.mainUI);
    this.modal = new HelpDeskModal(this.helper.mainUI);

    const openButton = document.getElementById(HELP_DESK_ENTRY);
    openButton.addEventListener('click', () => {
      this.overlay.toggleMenu();
    });

    const serviceButton = document.getElementById(HELP_DESK_SERVICE);
    serviceButton.addEventListener('click', () => {
      this.overlay.toggleMenu();
      this.modal.show();
    });

    const reportButton = document.getElementById(HELP_DESK_REPORT);
    reportButton.addEventListener('click', () => {
      this.overlay.toggleMenu();
    });

    this.modal.confirmButton.addEventListener('click', () => {
      this.teleport('serviceDesk');
      this.modal.hide();
    });
  }

  async teleport(location) {
    await this.helper.callC2sAPI('help-desk', 'teleport', this.helper.defaultTimeout, location);
  }

  async getAvailableLocations() {
    return await this.helper.callC2sAPI('help-desk', 'getAvailableLocations', this.helper.defaultTimeout);
  }

  /**
   * Returns true if this extension has a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} hasClient - See above.
   */
  static hasClient() {
    return true;
  }
}
export default Client;
