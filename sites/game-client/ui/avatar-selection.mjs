// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MAP_CELL_SIZE} from '../map-renderer.mjs';

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
  constructor(socket, graphicAsset) {
    this.socket = socket;
    this.graphicAsset = graphicAsset;
    this.DOM = document.getElementById(DOM_ID);
    this.selectedAvatar = [null, null]; // [displayChar, DOMElement]

    this.DOM.querySelector('button[name="submit"]').addEventListener('click', this.submit.bind(this));

    this.renderAvatars();
  }

  /**
   * Render
   */
  renderAvatars() {
    const container = this.DOM.querySelector('#avatar-preview-container');
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = tempCanvas.height = MAP_CELL_SIZE;

    for (const charName of Object.keys(this.graphicAsset.config.characters)) {
      // get image
      const renderInfo = this.graphicAsset.getCharacter(charName, 'D');
      tempCtx.drawImage(
          renderInfo.image,
          renderInfo.srcX,
          renderInfo.srcY,
          renderInfo.srcWidth,
          renderInfo.srcHeight,
          0,
          0,
          MAP_CELL_SIZE,
          MAP_CELL_SIZE,
      );

      // create DOM element
      const newAvatar = document.createElement('div');
      newAvatar.classList.add('single-avatar-container', 'container-center', 'hoverable');
      const img = document.createElement('img');
      img.src = tempCanvas.toDataURL();
      newAvatar.appendChild(img);
      newAvatar.addEventListener('click', this.setSelectedAvatar.bind(this, charName, newAvatar));
      container.appendChild(newAvatar);
    }

    // select random one by default
    container.children[Math.floor(Math.random() * container.children.length)].click();
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
   * Submit the display name and selected avatar.
   */
  submit() {
    // TODO
    const displayName = this.DOM.querySelector('input[name="display-name"]').value;
    this.socket.emit('avatarSelect', {displayName, displayChar: this.selectedAvatar[0]});
  }

  /**
   * Hide avatar selection page.
   */
  hide() {
    this.DOM.style.display = 'none';
  }
}

export default AvatarSelectionPage;
