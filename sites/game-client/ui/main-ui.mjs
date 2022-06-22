// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import OverlayPosition from './overlay-position.mjs';
import ContextMenu from './context-menu.mjs';
import LinkedList from '../../../common/utility/linked-list.mjs';
import UtilPanelManager from './utilpanel/utilpanel-manager.mjs';

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

const ROOTDIV_ID = 'rootdiv';
const TOOLBAR_ID = 'toolbar';
const NOTIFICATIONBAR_ID = 'notification-text';
const NOTIFICATION_CONTAINER_ID = 'notification';
const NOTIFICATION_PROGRESS_ID = 'notification-progress-bar';
const NOTIFICATION_PROGRESS_INNER_ID = 'notification-progress-bar-inner';
const NOTIFICATION_NUM_LIMIT = 4;
const ANNOUNCEMENT_ID = 'announcement-text';
const ANNOUNCEMENT_CONTAINER_ID = 'announcement';
const ANNOUNCEMENT_NUM_LIMIT = 10;
const NPC_ID = 'npc';
const NPCNAME_ID = 'npc-name';


const DEFAULT_NOTIFICATION_TIMEOUT = 8000; // ms
const DEFAULT_ANNOUNCEMENT_TIMEOUT = 30*1000; // ms

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
  constructor(clientType) {
    this.state = UIState.NORMAL_UI;
    this.overlays = new Map();
    this.activeModal = undefined;
    this.mapRenderer = undefined;
    this.clientType = clientType;

    window.addEventListener('resize', (evt) => { this._onResize(evt); });
    window.addEventListener('uiReady', (evt) => { this._onResize(evt); });

    // Cache the common used DOM elements.
    this.stagingDom = document.getElementById(STAGING_ID);
    this.modalBgDom = document.getElementById(MODAL_BG_ID);
    this.modalContDom = document.getElementById(MODAL_CONT_ID);
    this.overlayDom = {};
    for (const [pos, div] of OVERLAY_DIV.entries()) {
      this.overlayDom[pos] = document.getElementById(div);
    }

    this.rootdivDom = document.getElementById(ROOTDIV_ID);
    this.toolbarDom = document.getElementById(TOOLBAR_ID);
    this.notificationDom = document.getElementById(NOTIFICATIONBAR_ID);
    this.notificationContDom = document.getElementById(NOTIFICATION_CONTAINER_ID);
    this.notificationProgressDom = document.getElementById(NOTIFICATION_PROGRESS_ID);
    this.notificationProgressInnerDom = document.getElementById(NOTIFICATION_PROGRESS_INNER_ID);
    this.announcementDom = document.getElementById(ANNOUNCEMENT_ID);
    this.announcementContDom = document.getElementById(ANNOUNCEMENT_CONTAINER_ID);
    this.NPCDom = document.getElementById(NPC_ID);
    this.NPCNameDom = document.getElementById(NPCNAME_ID);
    this.NPCPreviousName = null;
    this.NPCPreviousSrc = null;

    this.utilPanelManager = new UtilPanelManager(this);
    this._notificationList = new Array();
    this._announcementList = new Array();

    const exitFocus = document.getElementById('exit-focus');
    exitFocus.onclick = () => {
      this.rootdivDom.classList.remove('focus-mode');
      this.focusOverlay.show(this.focusPos);
      this.mapRendererOverlay.show(OverlayPosition.MAIN_VIEW);
      console.log(this.exitCallback);
      if (this.exitCallback instanceof Function) {
        this.exitCallback();
      }
      this.exitCallback = () => {};
    };
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

  _setNotificationText(msg, timeout) {
    this.notificationDom.textContent = msg;
    this.notificationProgressInnerDom.style.setProperty('--animation-time', `${timeout}ms`);

    // Restart the animation by re-adding the animation class.
    this.notificationProgressDom.classList.remove('notification-progress-bar--active');
    // Force a reflow.
    this._unusedvar1 = this.notificationProgressDom.offsetHeight;
    this.notificationProgressDom.classList.add('notification-progress-bar--active');
  }

  updateNotification() {
    console.assert(this._notificationList.length > 0, 'Race condition in updateAnnouncement');

    // this._notificationList[0] was on display and it's now timed out.
    this._notificationList.shift();
    if (this._notificationList.length === 0) {
      // No more messages.
      this.notificationContDom.classList.add('notification--inactive');
      this.NPCDom.classList.remove('notification-npc--override');
      // No reflow necessary since we're hiding it.
      this.notificationDom.textContent = '';
      return;
    } else {
      // Continue to show the next message.
      const {msg, timeout} = this._notificationList[0];
      this._setNotificationText(msg, timeout);
      setTimeout(() => {
        this.updateNotification();
      }, timeout);
    }
  };

  _setAnnouncementMarquee(msg) {
    // We need this method because we want to compensate for longer text.
    this.announcementDom.textContent = msg;

    // Calculate the new animation length.
    const textLen = this.announcementDom.clientWidth;
    const parentLen = this.announcementDom.parentElement.clientWidth;
    const singleWidthTime = 5; // Going across the width should take 5s.
    const result = (textLen+parentLen)/(parentLen)*singleWidthTime;
    this.announcementDom.style.setProperty('--animation-time', `${result}s`);

    // Remove and add back the active class to force the animation to restart.
    this.announcementDom.classList.remove('announcement-marquee-inner--active');
    // Force a reflow.
    this._unusedvar1 = this.announcementDom.offsetHeight;
    this.announcementDom.classList.add('announcement-marquee-inner--active');
  }

  updateAnnouncement() {
    console.assert(this._announcementList.length > 0, 'Race condition in updateAnnouncement');

    // this._announcementList[0] was on display and it's now timed out.
    this._announcementList.shift();
    if (this._announcementList.length === 0) {
      // No more messages.
      this.announcementContDom.classList.add('announcement--inactive');
      // No reflow necessary since we're hiding it.
      this.announcementDom.textContent = '';
      return;
    } else {
      // Continue to show the next message.
      const {msg, timeout} = this._announcementList[0];
      this._setAnnouncementMarquee(msg);
      setTimeout(() => {
        this.updateAnnouncement();
      }, timeout);
    }
  };
  /**
   * Show npc hint.
   * @param {String} npc name wants to be shown. If null, not show anything.
   */
  showNPCHint(name, displayCharSrc) {
    const san_name = filterXSS(name);
    if (name === null) {
      if (this.NPCPreviousName !== null) {
        this.NPCDom.classList.add('notification--inactive');
        this.NPCPreviousName = null;
      }
    } else {
      if (this.NPCPreviousName !== san_name || this.NPCPreviousSrc !== displayCharSrc) {
        this.NPCDom.classList.remove('notification--inactive');
        this.NPCNameDom.textContent = san_name;
        // TODO: Cache the DOM
        $(".notification--npc--avatar > img").attr('src', displayCharSrc);
        this.NPCPreviousName = san_name;
        this.NPCPreviousSrc = displayCharSrc;
      }
    }
  }
  /**
   * Show notification in notification area.
   * @param {String} msg The message want to be shown.
   * @param {Number} timeout The duration of showing notification, the unit is millisecond. Should be an integer, otherwise the default is used.
   */
  showNotification(msg, timeout) {
    // Sanitize to prevent XSS
    const san_msg = filterXSS(msg);

    if (!Number.isInteger(timeout)) {
      timeout = DEFAULT_NOTIFICATION_TIMEOUT;
    }

    // Always enqueue the incoming notification. The first element of the list
    // is on display.
    const add_ele = {msg: san_msg, timeout: timeout};
    this._notificationList.push(add_ele);

    // Start the notification
    if (this._notificationList.length <= 1) {
      // Nothing was on display at the moment, we can display it directly.
      this.notificationContDom.classList.remove('notification--inactive');
      this.NPCDom.classList.add('notification-npc--override');
      this._setNotificationText(san_msg, timeout);
      setTimeout(() =>{
        this.updateNotification();
      }, timeout);
      return;
    }
    // If not, updateNotification() that was already scheduled by the previous
    // announcement will take care of things.
  }

  /**
   * Show announcement in marquee.
   * @param {String} msg The message want to be shown.
   * @param {Number} timeout The duraion of showing notification, the unit is millisecond. Should be an integer, otherwise the default is used.
   */
  showAnnouncement(msg, timeout) {
    // TODO: Handle the close button in annoucement's UI.

    // Sanitize to prevent XSS
    const san_msg = filterXSS(msg);

    if (!Number.isInteger(timeout)) {
      timeout = DEFAULT_ANNOUNCEMENT_TIMEOUT;
    }

    // Always enqueue the incoming announcement. The first element of the list
    // is on display.
    const add_ele = {msg: san_msg, timeout: timeout};
    this._announcementList.push(add_ele);

    // Start the notification
    if (this._announcementList.length <= 1) {
      // Nothing was on display at the moment, we can display it directly.
      this.announcementContDom.classList.remove('announcement--inactive');
      this._setAnnouncementMarquee(san_msg);
      setTimeout(() =>{
        this.updateAnnouncement();
      }, timeout);
      return;
    }
    // If not, updateAnnouncement() that was already scheduled by the previous
    // announcement will take care of things.
  }

  /**
   * Initiate the context menu.
   * @param {GameState} gameState The GameState object.
   * @param {MapRenderer} mapRenderer The Map Renderer
   * @param {InputManager} inputManager
   * @param {GameClient} gameClient The GameClient
   */
  createContextMenu(gameState, mapRenderer, inputManager, gameClient) {
    this.contextMenu = new ContextMenu(gameState, mapRenderer, inputManager, gameClient);
  }

  // If we want to use individual overlay for meeting
  // position = 0...n
  // setTopbarOverlay(position, overlay);
  // count=0 for no topbar.
  // resizeTopbarOverlay(count);

  /**
   * Extensions can call this to add custom DOM elements to the rootdiv.
   * It is usually recommended that callers first try other methods (such as
   * UtilPanelTab) to add content to the UI.
   * @param {DOM} dom - The DOM to add.
   */
  addCustomDOM(dom) {
    this.rootdivDom.appendChild(dom);
  }

  enterFocusMode(focusOverlay, focusPos, exitCallback) {
    this.focusOverlay = focusOverlay;
    this.focusPos = focusPos;
    this.exitCallback = exitCallback;

    this.rootdivDom.classList.add('focus-mode');
    this.focusOverlay.show(OverlayPosition.MAIN_VIEW);
  }

  /**
   * Enable a ruler div that shows the coordinate under the cursor.
   * Used only for debugging.
   */
  enableRuler() {
    $('#ruler-helper-div').css('z-index', '300');
    game.inputManager.registerCanvasOnMouseMoveMapCoord((coord) => {
      $('#ruler-helper-text').text(`Coord: ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`);
    });
  }

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
    // We do not place text or other stuff in the modal
    // container.
    this._evictDOM(this.modalContDom);
  }

  /**
   * Evict all children of the given DOM back into the staging div.
   * All text nodes under the DOM will be LOST.
   */
  _evictDOM(dom) {
    // We look at children and not childNode because we only care about
    // the DOM elements. Text nodes will be lost.
    for (const ele of dom.children) {
      this._restoreToStaging(ele);
    }
    dom.innerHTML = '';
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
    // If we're in any overlay, clear it out as well.
    if (overlay.isOpen) {
      console.info(`Clearing overflay in position to show it else where: `, overlay.position, position);
      this._clearOverlay(overlay.position, overlay);
    }

    this.overlays.set(position, overlay);
    const container = this.overlayDom[position];
    container.appendChild(overlay.dom);
    container.classList.remove('overlay--inactive');
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
    this.overlayDom[position].classList.add('overlay--inactive');
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
