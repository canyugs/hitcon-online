// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MAP_CELL_SIZE} from '../map-renderer.mjs';
import {PLAYER_DISPLAY_NAME_MAX_LENGTH} from '../../../common/gamelib/player.mjs';
import {randomChoice} from '../../../common/utility/random-tool.mjs';

const DOM_ID = 'avatar-selection-div';

/**
 * The logic of avatar selection page.
 */
class AvatarSelectionPage {
  /**
   * @constructor
   * @param {Socket} socket
   * @param {GraphicAsset} graphicAsset
   */
  constructor(graphicAsset) {
    this.onSelectAvatar = null;
    this.onSelectAvatarSet = new Promise((resolve) => {
      this.onSelectAvatarSetResolve = resolve;
    });
    this.graphicAsset = graphicAsset;
    this.DOM = document.getElementById(DOM_ID);
    this.selectedAvatar = [null, null]; // [displayChar, DOMElement]
    this.avatarDOM = new Map();

    this.DOM.querySelector('button[name="submit"]').addEventListener('click', this.submit.bind(this));

    this.renderAvatars();
  }

  /**
   * Set the onSelectAvatar.
   */
  setOnSelectAvatar(callback) {
    console.assert(this.onSelectAvatar === null, 'Duplicate call to setOnSelectAvatar');
    this.onSelectAvatar = callback;
    this.onSelectAvatarSetResolve(true);
  }

  /**
   * Render
   */
  renderAvatars() {
    const container = this.DOM.querySelector('#avatar-preview-container');

    for (const charName of Object.keys(this.graphicAsset.config.characters)) {
      if (this.graphicAsset.config.characters[charName].isNPC === true) {
        // We don't allow selecting NPC image.
        continue;
      }

      // create DOM element
      const newAvatar = document.createElement('div');
      newAvatar.classList.add('single-avatar-container', 'container-center', 'hoverable');
      const img = document.createElement('img');
      img.src = this.graphicAsset.characterToImageURL(charName, 'D', MAP_CELL_SIZE, MAP_CELL_SIZE);
      newAvatar.appendChild(img);
      newAvatar.addEventListener('click', this.setSelectedAvatar.bind(this, charName, newAvatar));
      this.avatarDOM.set(charName, newAvatar);
      container.appendChild(newAvatar);
    }

    // select random one by default
    randomChoice(container.children).click();
  }

  /**
   * Set the selected avatar.
   * @param {String} displayChar
   * @param {DOMElement} ele
   */
  setSelectedAvatar(displayChar, ele) {
    if (this.selectedAvatar[1] !== null) {
      this.selectedAvatar[1].classList.remove('avatar-selected');
    }
    this.selectedAvatar = [displayChar, ele];
    ele.classList.add('avatar-selected');
  }

  /**
   * Set the character selected and display name on screen.
   * This is usually called by gameClient when the server supplied the data
   * from previous session.
   */
  setDisplayCharAndNameOnScreen(displayChar, displayName) {
    if (typeof displayChar === 'string' && this.avatarDOM.has(displayChar)) {
      this.avatarDOM.get(displayChar).click();
    } else {
      console.warn('Cannot find displayChar in setDisplayCharAndNameOnScreen: ', displayChar);
    }

    if (typeof displayName === 'string') {
      this.DOM.querySelector('input[name="display-name"]').value = displayName;
    } else {
      console.warn('Invalid displayName in setDisplayCharAndNameOnScreen: ', displayName);
    }
  }

  /**
   * Send the selection to gateway server.
   */
  async _submit(displayName, displayChar) {
    await this.onSelectAvatarSet;
    this.onSelectAvatar(displayName, displayChar);
  }

  /**
   * Submit the display name and selected avatar.
   */
  submit() {
    const displayName = this.DOM.querySelector('input[name="display-name"]').value;
    if (displayName.length > PLAYER_DISPLAY_NAME_MAX_LENGTH || displayName.length <= 0) {
      alert(`Name should be non-empty and no longer than ${PLAYER_DISPLAY_NAME_MAX_LENGTH}`);
      return;
    }
    const displayChar = this.selectedAvatar[0];
    if (displayChar === null) {
      alert('Please select a character');
      return;
    }
    this._submit(displayName, displayChar);
  }

  /**
   * Automatically skip the selection screen.
   * This is usually used for debugging purpose.
   */
  autoSubmit(displayName, displayChar) {
    if (displayChar === null) {
      displayChar = this.selectedAvatar[0];
    }
    this._submit(displayName, displayChar);
  }

  /**
   * Hide avatar selection page.
   */
  hide() {
    this.DOM.style.display = 'none';
  }
}

export default AvatarSelectionPage;
