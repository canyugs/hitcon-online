// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const PLAYERLIST_DIV = 'playerlist-overlay';

class PlayerlistOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(PLAYERLIST_DIV);
    super(mainUI, dom);
  }

  // TODO(zeze-zeze): Expand on this class (jsdoc and implementation) and
  // implement onPre/PostShow/Hide() as needed.

  hasToolbarButton() {
    this.toolbarButtonSrc = '/static/extensions/playerlist/playerlist.svg';
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
  }

  async gameStart() {
    this.overlay = new PlayerlistOverlay(this.helper.mainUI);
    this.overlay.show(OverlayPosition.LEFT_TOP);
    this.showPlayerList();
  }

  /**
   * Show player list on left top.
   * @showPlayerList
   */
  showPlayerList() {
    // TODO(zeze-zeze): Optimize the way to update playerlist
    setInterval(() => {
      document.getElementById('playerlist').innerHTML = '';
      this.helper.gameState.getPlayers().forEach(playerID => {
        if (typeof playerID.displayName !== 'string' || !playerID.displayName.includes(document.getElementById("searchPlayer").value)) {
          return;
        }
        document.getElementById('playerlist').innerHTML += '<span>' + this.HTMLEncode(playerID.displayName); + '</span>';
     });
    }, 1000);
  }

  /**
   * Encode the html in case of XSS
   * @HTMLEncode
   * @param {string} str - the string being encoded
   */
  HTMLEncode(str) {
    return $('<div/>').text(str).html();
  }
}

export default Client;
