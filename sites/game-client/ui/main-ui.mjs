// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import OverlayPosition from './overlay-position.mjs';
import ContextMenu from './context-menu.mjs';
import LinkedList from '../../../common/utility/linked-list.mjs';

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
OVERLAY_DIV.set(OverlayPosition.CENTER_TOP, 'overlay-centertop');
OVERLAY_DIV.set(OverlayPosition.MAIN_VIEW, 'main-view');

const TOOLBAR_ID = 'toolbar';
const NOTIFICATIONBAR_ID = 'notification-bar';
const NOTIFICATION_NUM_LIMIT = 4;
const ANNOUNCEMENT_ID = 'announcement-bar';
const ANNOUNCEMENT_STRING = 'announcement-bar-span';
const ANNOUNCEMENT_NUM_LIMIT = 4;

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
    this.mapRenderer = undefined;

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
    this.notificationDom = document.getElementById(NOTIFICATIONBAR_ID);
    this.announcementDom = document.getElementById(ANNOUNCEMENT_ID);
    this.announcementWord = document.getElementById(ANNOUNCEMENT_STRING);
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

  /**
   * Show notification in notification area.
   * @param {String} msg The message want to be shown.
   * @param {Number} timeout The duraion of showing notification, the unit is millisecond.
   */
  showNotification(msg, timeout) {
    // TODO(lisasasasa)
    // Every element of the list is {ele, next}, where `ele` is DOMElement
    this._msgList ??= new LinkedList();

    // An arrow function to remove the notification
    const removeNotification = (listNode, clear) => {
      const {ele, timer} = listNode.content;
      if (clear) clearTimeout(timer);
      if (this._msgList.delete(listNode)) this.notificationDom.removeChild(ele);
    };

    // Before inserting the new notification, check if list exceed the limit
    if (this._msgList.length === NOTIFICATION_NUM_LIMIT) {
      removeNotification(this._msgList.findNode(NOTIFICATION_NUM_LIMIT), true);
    }

    const ele = document.createElement('div');
    const msgEle = document.createTextNode(msg);
    ele.appendChild(msgEle);

    this.notificationDom.appendChild(ele);
    const content = {ele};
    const listNode = this._msgList.insert(content);

    const timer = setTimeout(() =>{
      removeNotification.bind(this, listNode, false)();
    }, timeout);
    listNode.content.timer = timer;
    console.log(this._msgList)
  }

  /**
   * Show announcement in marquee.
   * @param {String} msg The message want to be shown.
   * @param {Number} timeout The duraion of showing notification, the unit is millisecond.
   */
  showAnnouncement(msg, timeout) {
    // Every element of the list is {sting, next}
    this._announceList ??= new LinkedList();
    // TODO(marquee)
    // An arrow function to remove the notification
    const removeNotification = (listNode, clear) => {
      const {msg, timer} = listNode.content;
      if (clear) clearTimeout(timer);
      if (this._announceList.delete(listNode)) {
        this.announcementWord.textContent = this._announceList.findAllElement().join('  ');
      }
    };

    if (this._announceList.length === NOTIFICATION_NUM_LIMIT) {
      removeNotification(this._announceList.findNode(NOTIFICATION_NUM_LIMIT), true);
    }

    const content = {msg};
    const listNode = this._announceList.insert(content);
    this.announcementWord.textContent = this._announceList.findAllElement().join('  ');
    const timer = setTimeout(() =>{
      removeNotification.bind(this, listNode, false)();
    }, timeout);
    listNode.content.timer = timer;
  }

  /**
   * Initiate the context menu.
   * @param {GameState} gameState - The GameState object.
   * @param {MapRenderer} mapRenderer
   */
  createContextMenu(gameState, mapRenderer) {
    this.contextMenu = new ContextMenu(gameState, mapRenderer);
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
