// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// enum
const OverlayPosition = Object.freeze({
    LEFT_TOP: Symbol(),
    LEFT_CENTER: Symbol(),
    LEFT_BOTTOM: Symbol(),
    RIGHT: Symbol()
    //CENTER_TOP: Symbol(), // overlapped with notification
    /* 
    CENTER_BOTTOM: Symbol(),
    RIGHT_TOP: Symbol(),
    RIGHT_CENTER: Symbol(),
    RIGHT_BOTTOM: Symbol()
    */
});

/** 
 * Represents an overlay
 * 
 * Those who wants to use the Overlay element should extend this class and implement the methods.
*/
class Overlay {
    /**
     * 
     * @param dom HTML DOM element.
     */
    constructor(dom) {}
  
    // Overlay hide/show related properties.
    /**
     * If true, user can hide the overlay.
     * 
     * This property should be implemented by the base class.
     */
    canHide() {}

    /**
     * If true, user can dismiss the overlay.
     *
     * This property should be implemented by the base class.
     */
    canDismiss() {}
    
    /**
     * Unset ToolbarButton display=none.
     */
    showToolbarButton() { }

    /**
     * Set ToolbarButton display=none.
     */
    hideToolbarButton() { }

    /**
     * If the overlay has ToolbarButton, it should toggle the overlay hide/show state
     * when the button is clicked.
    */
    onClickToolbarButton()
  
    /*
    -> HIDDEN -> SHOW -+
       |  ^-------|    |
       +---------------+
       V
    DISMISSED
    */
  
    /**
     * Set visibility=hidden.
     * 
     * state: HIDDEN -> SHOW
     */ 
    show();

    /**
     * Unset visibility=hidden.
     * 
     * state: SHOW -> HIDE
     */
    hide();
    
    /**
     * Destroy the overlay.
     * 
     * state: SHOW/HIDDEN -> DISMISS
     */
    dismiss();
  
    /**
     * execute when the overlay is dismissed.
     * 
     * This method should be implemented in the derived class.
     */
    onDismiss()

    /**
     * execute when the overlay is shown.
     * 
     * This method should be implemented in the derived class.
     */
    onShow()

    /**
     * execute when the overlay is hidden.
     * 
     * This method should be implemented in the derived class.
     */
    onHide()
};

export default Overlay;