// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const PLAYERLIST_DIV = 'playerlist-overlay';

class PlayerlistOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(PLAYERLIST_DIV);
    super(mainUI, dom);
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
    this.toolbarButton = new ToolbarButton('/static/extensions/playerlist/common/playerlist.svg');
    this.toolbarButton.registerAsToggle(this.overlay);
    this.toolbarButton.show();

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
        // TODO(zeze-zeze): Keep a record of dom elements
        // TODO(zeze-zeze): Move it to a separate function
        document.getElementById('playerlist').innerHTML += '<span>' + this.HTMLEncode(playerID.displayName); + '</span>';

        // TODO(zeze-zeze): Use onchange callback to update playerlist instead of waiting 1 second
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
