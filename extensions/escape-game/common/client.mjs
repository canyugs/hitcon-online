// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from '/static/sites/game-client/ui/modal.mjs';

const TERMINAL_CONTAINER = 'terminal-container';
const TERMINAL_DIV = 'terminal';
const TERMINAL_SERVER = '127.0.0.1:5050';

class TerminalModal extends Modal {
  constructor(mainUI) {
    const DOM = document.getElementById(TERMINAL_CONTAINER);
    super(mainUI, DOM);

    $('#terminal-button').on('click', () => {
      this.show();
    });
    $('#terminal-close-btn').on('click', () => {
      this.hide();
    });
    this.customOnPostShow = () => {};
    this.customOnPostHide = () => {};
  }

  /**
   * Register onPostShow and onPostHide
   */
  registerCallbacks(onPostShow, onPostHide) {
    this.customOnPostShow = onPostShow;
    this.customOnPostHide = onPostHide;
  }

  /**
   * Called after it's shown.
   */
  onPostShow() {
    // Set the size.
    this.setSize('80%', '25%');
    this.setPosition('10%', '55%');
    this.customOnPostShow();
    return true;
  }

  /**
   * Called after it's hidden.
   */
   onPostHide() {
    this.customOnPostHide();
    return true;
  }
};

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
    this.token = null;
    this.socket = null;
    this.term = null;
    this.roomId = null;
  }

  async gameStart() {
    this.modal = new TerminalModal(this.helper.mainUI);
    this.modal.registerCallbacks(this.setupPty.bind(this), this.cleanup.bind(this));
  }

  /**
   * Get the access token for the container.
   */
   async getAccessToken() {
    const result = await this.helper.callC2sAPI('escape-game', 'getAccessToken', 5000, 'test');
    this.token = result;
    console.log(`Access token for the container: ${JSON.stringify(result)}`);
  }

  /**
   * Create a new room.
   */
  async createRoom() {
    const result = await this.helper.callC2sAPI('escape-game', 'createRoom', 5000);
    console.log('create room', result);
    this.roomId = result;
  }

  /**
   * Join room
   */
  async joinRoom() {
    const result = await this.helper.callC2sAPI('escape-game', 'joinRoom', 5000, this.roomId);
    console.log('join room', result);
    this.roomId = result;
  }

  /**
   * Setup the socket.io connection and xterm.js.
   */
  async setupPty() {
    // TODO: for test.
    await this.createRoom();
    await this.joinRoom();

    await this.getAccessToken();

    if (!this.token) {
      throw new Error('No token found.');
    }

    this.term = new Terminal({cursorBlink: true});
    this.term.open(document.getElementById(TERMINAL_DIV));

    this.socket = window.io(TERMINAL_SERVER, {reconnection: false});

    this.socket.on('connect', () => {
      this.term.write('\r\n*** Connected ***\r\n');

      this.term.onData((data) => {
        this.socket.emit('ptyDataInput', data);
      });

      this.socket.on('ptyDataOutput', (data) => {
        this.term.write(data);
      });

      this.socket.on('disconnect', () => {
        this.term.write('\r\n*** Disconnected ***\r\n');
      });
    });

    this.socket.emit('connectTerminal', {
      token: this.token
    });
  }

  cleanup() {
    this.helper.callC2sAPI('escape-game', 'destroyRoom', 5000, this.roomId);


    this.socket.disconnect();
    this.socket = null;

    this.term.dispose();
    this.term = null;
  }


}

export default Client;
