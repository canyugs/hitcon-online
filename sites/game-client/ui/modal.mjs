// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * The modal is a center aligned window above the MainView.
 * Before closing the modal, user cannot interactive with other components.
 *
 * Those who wants to use the Modal element should extend this class and implement the methods.
 */
class Modal {
  /**
   * The modal have a default size, can call setSize() to change it.
   * @param dom HTML DOM element.
   */
  constructor(mainUI, dom) {
    this.mainUI = mainUI;
    this.dom = dom;
    console.log(this.dom);
    // Some sensible default value.
    this.width = '60%';
    this.height = '50%';
    this.top = '25%';
    this.left = '20%';
  }

  /**
   * Set the modal container size.
   * This is usually called by the derived class to set the modal container
   * size.
   * @param {String} width - The width of modal, should be a vaild css units.
   * @param {String} height - The height of modal, should be a vaild css units.
   */
  setSize(width, height) {
    this._assertActive();
    this.mainUI.modalContDom.style.width = width;
    this.mainUI.modalContDom.style.height = height;
  }

  /**
   * Set the modal container position.
   * This is usually called by the derived class to set the modal container
   * position.
   * Both parameters should be a valid css unit.
   * @param {String} left - CSS 'left' for the DOM.
   * @param {String} top - CSS 'top' for the DOM.
   */
  setPosition(left, top) {
    this._assertActive();
    this.mainUI.modalContDom.style.left = left;
    this.mainUI.modalContDom.style.top = top;
  }

  /**
   * If returns true, user can dismiss the modal.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to adjust this default behaviour.
   */
  canDismiss() {
    return true;
  }

  /**
   * Unset ToolbarButton display=none.
   */
  showToolbarButton() {
    this.toolbarButton.style.display = null;
  }

  /**
   * Set ToolbarButton display=none.
   */
  hideToolbarButton() {
    this.toolbarButton.style.display = 'none';
  }

  /*
  State transition for the Modal class.
    -> HIDDEN -> ACTIVE -+
       |  ^-------|      |
       +-----------------+
       V
       DISMISSED

  ACTIVE: Modal is currently being shown.
  HIDDEN: Modal is not being shown, but if configured, the toolbar button
          is visible.
  DISMISSED: Modal is not being shown, and toolbar button is not visible.
  */

  /**
   * Returns true if it's active.
   * @param {Boolean} active - If it's active.
   */
  isActive() {
    return this.mainUI.activeModal === this;
  }

  /**
   * Helper function that raises an exception if this modal is not active.
   */
  _assertActive() {
    console.assert(this.isActive(),
                   'Modal.setSize() called when not active');
  }

  /**
   * This is called when the toolbar button is clicked.
   * If the modal has ToolbarButton, it should show the modal
   * when the button is clicked.
   */
  onClickToolbarButton() {
    this.show();
  }
  
  // Return root dom element.
  getDOM() {
    return this.dom;
  }
  
  /**
   * Transition from HIDDEN to ACTIVE.
   */
  show() {
    const proceed = this.onPreShow();
    // If onPreShow() says don't do it, then don't.
    if (!proceed) return proceed;

    const ret = this.mainUI._setModal(this);
    // If setModal failed, then we stop here.
    if (!ret) return ret;
    this.ensureButtonsShown();

    this.onPostShow();
    return ret;
  }

  /**
   * Used to indicate to MainUI the list of DOM Elements to add to
   * modal container.
   */
  _getModalDOM() {
    return [this.dom];
  }

  /**
   * Transition to HIDDEN state.
   */
  hide() {
    if (this.mainUI.activeModal !== this) {
      console.warn('Calling hide() on inactive modal.');
      return false;
    }
  
    const proceed = this.onPreHide();
    // If onPreHide() says don't do it, then don't.
    if (!proceed) return proceed;

    const ret = this.mainUI._clearModal(this);
    // If clearModal failed, then we stop here.
    if (!ret) return ret;

    this.onPostHide();
    return ret;
  }

  /**
   * Transition to DIMISSED state.
   */
  dismiss() {
    this.hide();

    this.ensureButtonsHidden();
  }

  /**
   * Ensure all toolbar buttons that should be shown in ACTIVE/HIDDEN is shown.
   * Calling this multiple times should have no extra side effect.
   */
  ensureButtonsShown() {
    // TODO(fanlan1210)
  }

  /**
   * Ensure all toolbar buttons that should be hidden should be hidden.
   * Calling this multiple times should have no extra side effect.
   */
  ensureButtonsHidden() {
    // TODO(fanlan1210)
  }

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
    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
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
  onPostHide() { return true; }

  /**
   * Executes when the window is resized.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onResize(evt) {}
}

export default Modal;
