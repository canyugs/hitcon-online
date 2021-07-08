// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// enum
const OverlayPosition = Object.freeze({
    LEFT_TOP: Symbol(),
    LEFT_CENTER: Symbol(),
    LEFT_BOTTOM: Symbol(),
    //CENTER_TOP: Symbol(), // overlapped with notification
    CENTER_BOTTOM: Symbol(),
    RIGHT_TOP: Symbol(),
    RIGHT_CENTER: Symbol(),
    RIGHT_BOTTOM: Symbol()
});

/** 
 * Represents an overlay
*/
class Overlay {
    constructor(dom) {}
  
    // Overlay hide/show related properties.
    canHide() {}

    canDismiss() {}
    
    showToolbarButton(icon) {}

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
     */
    onDismiss()

    /**
     * execute when the overlay is shown.
     */
    onShow()

    /**
     * execute when the overlay is hidden.
     */
    onHide()
};

export default Overlay;