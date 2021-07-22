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
    constructor(dom) {}

    /**
     * Set the modal size.
     * @param {String} width the width of modal, should be a vaild css units.
     * @param {String} height the height of modal, should be a vaild css units.
     */
    setSize(width, height) { }
  
    /**
     * If true, user can dismiss the modal.
     * 
     * This method can be implemented in the derived class if the derived class
     * wishes to adjust this default behaviour.
     */ 
    canDismiss() {}
    
    /**
     * Unset ToolbarButton display=none.
     */
    showToolbarButton() {}

    /**
     * Set ToolbarButton display=none.
     */
    hideToolbarButton() { }


    /**
     * If the modal has ToolbarButton, it should show the modal
     * when the button is clicked.
    */
    onClickToolbarButton()
  
    // Return root dom element.
    getDOM() {}
  
    // Unset display=none and update MainUI.
    show() {}
  
    /**
     *  Set display=none and update MainUI.
    */
    dismiss() {}
    
    /**
     * execute when the overlay is dismissed.
     * 
     * This method can be implemented in the derived class if the derived class
     * wishes to handle this event.
     */
    onDismiss()
    
    /**
     * execute when the overlay is shown.
     * 
     * This method can be implemented in the derived class if the derived class
     * wishes to handle this event.
     */
    onShow()
}

export default Modal;
