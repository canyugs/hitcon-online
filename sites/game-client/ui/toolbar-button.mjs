// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const TOOLBAR_ID = 'toolbar-tabs';

/**
 * A toolbar button
 */
class ToolbarButton {
  /**
   * @param {String} iconSrc The icon of the button.
   * @param {Boolean} createDOM Whether the DOM element should be created by the constructor.
   * Should set to false if you want to handle the DOM element creation yourself.
   */
  constructor(iconSrc, createDOM = true) {
    this.iconSrc = iconSrc;
    this.dom = null;
    this.onClickCallbacks = null;
    this.isVisible = false;

    this.isToggle = false;
    this.toggleTarget = null;

    if (createDOM) {
      // Create DOM element
      this.dom = document.createElement('button');
      this.dom.classList.add('toolbar-button');
      this.dom.style.display = 'none';

      // load icon asset into button
      const icon = new Image();
      icon.src = this.iconSrc;

      this.dom.appendChild(icon);

      document.getElementById(TOOLBAR_ID).appendChild(this.dom);
    }
  }

  /**
   * Register the button as overlay or modal visibility switch.
   * @param {Object} toggleTarget A overlay or modal object.
   */
  registerAsToggle(toggleTarget) {
    this.isToggle = true;
    this.toggleTarget = toggleTarget;

    if (this.dom) {
      this.dom.addEventListener('click', () => {
        // TODO remove active from other button;
        this.dom.classList.toggle('active');
        this.toggleTarget?.onClickToggleButton();
      });
    }
  }

  /**
   * Register a callback function for the button.
   * @param {Function} f The callback function.
   */
  registerOnClick(f) {
    if (this.isToggle) {
      throw new Error('The button is used for toggling the visibility of an overlay or a modal.');
    }

    this.onClickCallbacks = f;
    if (this.dom) {
      this.dom.addEventListener('click', () => {
        f();
      });
    }
  }

  /**
   * Register an DOM element. This can be useful if one wants to maintain the DOM element by itself.
   * @param {Element} dom The DOM element.
   */
  registerDom(dom) {
    this.dom = dom;

    if (!this.isToggle && this.onClickCallbacks) {
      this.dom.addEventListener('click', () => {
        this.onClickCallbacks();
      });
    }

    if (this.isToggle && this.toggleTarget) {
      this.dom.addEventListener('click', () => {
        this.toggleTarget?.onClickToggleButton();
      });
    }

    if (this.isVisible) {
      this.dom.style.display = null;
    } else {
      this.dom.style.display = 'none';
    }
  }

  /**
   * Change the icon of the button
   * @param {string} iconSrc The path of the icon.
   */
  changeIcon(iconSrc) {
    this.iconSrc = iconSrc;

    if (this.dom && this.dom.getElementsByTagName('img').length > 0) {
      this.dom.getElementsByTagName('img')[0].src = iconSrc;
    }
  }

  /**
   * Show the button.
   */
  show() {
    if (this.isVisible) {
      return;
    }

    this.isVisible = true;
    if (this.dom) {
      this.dom.style.display = null;
    }
  }

  /**
   * Hide the button.
   */
  hide() {
    if (!this.isVisible) {
      return;
    }

    this.isVisible = false;
    if (this.dom) {
      this.dom.style.display = 'none';
    }
  }
}

export default ToolbarButton;
