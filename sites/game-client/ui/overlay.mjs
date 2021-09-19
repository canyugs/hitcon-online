// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Represents an overlay
 *
 * Those who wants to use the Overlay element should extend this class and implement the methods.
*/
class Overlay {
  /**
   * @param dom HTML DOM element.
   */
  constructor(mainUI, dom) {
    this.mainUI = mainUI;
    this.dom = dom;
    this.position = undefined;
    this.positionCache = undefined;
    this.isOpen = undefined;
  }

  /**
   * If true, user can hide the overlay.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to adjust this default behaviour.
   */
  canHide() {
    // Fail safe default.
    return true;
  }

  /**
   * If true, user can dismiss the overlay.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to adjust this default behaviour.
   */
  canDismiss() {
    // Fail safe default.
    return true;
  }

  /**
   * If the overlay has ToolbarButton, it should toggle the overlay hide/show state
   * when the button is clicked.
  */
  onClickToggleButton() {
    // WIP(fanlan1210)
    console.assert(this.positionCache, 'positionCache does not have default value.');
    if (this.canHide() && this.position !== undefined) {
      this.positionCache = this.position; // store current position state
      this.hide();
    } else this.show(this.positionCache); // resore position state
  }

  /*
  -> HIDDEN -> SHOW -+
     |  ^-------|    |
     +---------------+
     V
  DISMISSED
  */

  /**
   * Transfer the state: HIDDEN -> SHOW
   */
  show(position) {
    const proceed = this.onPreShow();
    // If onPreShow() says don't do it, then don't.
    if (!proceed) return proceed;

    const ret = this.mainUI._setOverlay(position, this);
    // If setOverlay failed, then we stop here.
    if (!ret) return ret;
    this.position = position;

    this.onPostShow();
    return ret;
  }

  /**
   * Unset visibility=hidden.
   *
   * state: SHOW -> HIDE
   */
  hide() {
    const proceed = this.onPreHide();
    // If onPreHide() says don't do it, then don't.
    if (!proceed) return proceed;

    const ret = this.mainUI._clearOverlay(this.position, this);
    // If clearOverlay failed, then we stop here.
    if (!ret) return ret;
    this.position = undefined;

    this.onPostHide();
    return ret;
  }

  /**
   * Destroy the overlay.
   *
   * state: SHOW/HIDDEN -> DISMISS
   */
  dismiss() {}

  /**
   * Executes when the overlay is dismissed.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onDismiss() {}

  /**
   * Executes before the overlay is shown.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPreShow() { return true; }

  /**
   * Executes after the overlay is shown.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPostShow() {
    this.isOpen = true;
    return true;
  }

  /**
   * Executes before the overlay is hidden.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPreHide() { return true; }

  /**
   * Executes after the overlay is hidden.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPostHide() {
    this.isOpen = false;
    return true;
  }

  /**
   * Executes when the window is resized.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onResize(evt) {}

};

export default Overlay;
