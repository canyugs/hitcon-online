// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from '/static/sites/game-client/ui/modal.mjs';
import {MapCoord} from '/static/common/maplib/map.mjs';
import InteractiveObjectClientBaseClass from '/static/common/interactive-object/client.mjs';

const LAYER_DOOR = {zIndex: 6, layerName: 'escapeGameDoor'};

const TERMINAL_CONTAINER = 'terminal-container';
const TERMINAL_DIV = 'terminal';

class TerminalModal extends Modal {
  constructor(mainUI) {
    const DOM = document.getElementById(TERMINAL_CONTAINER);
    super(mainUI, DOM);

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
    this.setPosition('10%', '7%');
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
    this.terminalServerAddress = null;

    this.terminals = new Map();
  }

  async gameStart() {
    this.modal = new TerminalModal(this.helper.mainUI);
    this.modal.registerCallbacks(this.setupPty.bind(this), this.cleanup.bind(this));

    this.helper.mapRenderer.registerCustomizedLayerToDraw(LAYER_DOOR.zIndex, LAYER_DOOR.layerName);

    const listOfTerminals = await this.helper.callC2sAPI('escape-game', 'getListOfTerminals', this.helper.defaultTimeout);
    for (const terminalId of listOfTerminals) {
      const clientInfo = await this.helper.callC2sAPI('escape-game', 'getTerminalClientInfo', this.helper.defaultTimeout, terminalId);
      this.terminals.set(terminalId, new TerminalObject(this.helper, terminalId, clientInfo));
    }

    this.terminalServerAddress = await this.helper.callC2sAPI('escape-game', 'getTerminalServerAddress', this.helper.defaultTimeout);
  }

  /**
   * Setup the socket.io connection and xterm.js.
   */
  async setupPty() {
    if (!this.token) {
      throw new Error('No token found.');
    }

    this.term = new Terminal({cursorBlink: true});
    this.term.open(document.getElementById(TERMINAL_DIV));

    this.socket = window.io(this.terminalServerAddress.address, {reconnection: false, path: this.terminalServerAddress.path});

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

  async s2c_showTerminalModal(token) {
    this.token = token;
    this.modal.show();
    return true;
  }

  cleanup() {
    this.socket.disconnect();
    this.socket = null;

    this.term.dispose();
    this.term = null;
  }
}


/**
 * TODO: jsdoc
 */
 class TerminalObject extends InteractiveObjectClientBaseClass {
  /**
   * TODO
   * @param {ClientExtensionHelper} helper - The extension helper.
   * @param {String} terminalId - The identifier of the terminal.
   * @param {MapCoord} initialPosition - Position of the terminal.
   * @param {Array} displayConfig - Display config.
   */
  constructor(helper, terminalId, clientInfo) {
    const mapCoord = MapCoord.fromObject(clientInfo.initialPosition);
    clientInfo.mapCoord = mapCoord;
    const facing = 'D';

    for (const cfg of clientInfo.displayConfig) {
      if (cfg.layerName === 'terminalImage') {
        cfg.renderArgs = {
          mapCoord: mapCoord,
          displayChar: cfg.character,
          facing: facing,
          getDrawInfo() {
            return {mapCoord: this.mapCoord, displayChar: this.displayChar, facing: this.facing};
          },
        };
      } else if (cfg.layerName === 'terminalName') {
        cfg.renderArgs = {
          mapCoord: mapCoord,
          displayName: terminalId,
          getDrawInfo() {
            return {mapCoord: this.mapCoord, displayName: this.displayName};
          },
        };
      }
    }

    const interactFunction = () => {
      console.log('terminal start interaction.');
      helper.callC2sAPI('escape-game', 'startInteraction', this.helper.defaultTimeout, terminalId);
    };

    super(helper, clientInfo, interactFunction);
    this.terminalId = terminalId;
  }
}

export default Client;
