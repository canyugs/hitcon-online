// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * The modal is a center aligned window above the MainView.  
 * Before closing the modal, user cannot interactive with other components.
 */
class Modal {
    constructor() {}
  
    /**
     * Set the modal size.
     * @param {Number} width
     * @param {Number} height
     */
    setSize(width,height) {}
  
    // If true, user can dismiss the modal.
    canDismiss() {}
    
    showToolbarButton(icon) {}
  
    // Return root dom element.
    getDOM() {}
  
    // Unset display=none and update MainUI.
    show() {}
  
    /**
     *  Set display=none and update MainUI.
    */
     dismiss() {}
  
    // onDismiss(), onShow()
}

export default Modal;