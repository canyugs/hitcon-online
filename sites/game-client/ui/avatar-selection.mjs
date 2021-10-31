// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const DOM_ID = 'avatar-selection-div';

/**
 * The logic of avatar selection page.
 */
class AvatarSelectionPage {
  /**
   * @constructor
   * @param {Socket} socket - A socket.io socket.
   */
  constructor(socket) {
    this.socket = socket;
    this.DOM = document.getElementById(DOM_ID);

    this.DOM.querySelector('button[name="submit"]').addEventListener('click', this.submit.bind(this));

    // TODO: get camera and microphone
  }

  /**
   * Submit the display name and selected avatar.
   */
  submit() {
    // TODO
    const displayName = this.DOM.querySelector('input[name="display-name"]').value;
    this.socket.emit('avatarSelect', {displayName, displayChar: 'char1'});
  }

  /**
   * Hide avatar selection page.
   */
  hide() {
    this.DOM.style.display = 'none';
  }
}

export default AvatarSelectionPage;
