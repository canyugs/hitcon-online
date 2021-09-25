// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const BUTTON_CONTAINER_ID = 'utilpanel-tabs';
/**
 * Button for selecting the util panel tab.
 */
class UtilPanelButton {
  /**
   * @param {String} name - Name of the tab.
   * @param {String} iconSrc - The icon of the button.
   */
  constructor(name, iconSrc) {
    console.log(name);
    this.iconSrc = iconSrc;
    this.name = name;

    // Create DOM element
    this.dom = document.createElement('label');
    this.dom.classList.add('utilpanel-button');
    this.dom.id = `utilpanel-button-${name}`;

    this.dom.innerHTML = `<input type="radio" name="utilpanel" ` +
      `value="${name}" class="utilpanel-radio" />` +
      `<div><img id="utilpanel-btnimg-${name}"></div>`;

    document.getElementById(BUTTON_CONTAINER_ID).appendChild(this.dom);

    // load icon asset into button
    document.getElementById(`utilpanel-btnimg-${name}`).src = this.iconSrc;
  }
};

export default UtilPanelButton;
