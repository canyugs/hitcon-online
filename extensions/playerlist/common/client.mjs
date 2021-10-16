// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import UtilPanelTab from '/static/sites/game-client/ui/utilpanel/utilpanel-tab.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const PLAYERLIST_DIV = 'playerlist-overlay';
const ICON_SVG = '/static/extensions/playerlist/common/playerlist.svg';

class PlayerlistTab extends UtilPanelTab {
  constructor(mainUI) {
    const dom = document.getElementById(PLAYERLIST_DIV);
    super(mainUI.utilPanelManager, dom, 'playerlist', ICON_SVG);
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
    this.tab = new PlayerlistTab(this.helper.mainUI);

    this.showPlayerList();
  }

  /**
   * Show player list on left top.
   * @showPlayerList
   */
  showPlayerList() {
    const template = document.getElementById('playerlist-player').cloneNode(true);
    // TODO(zeze-zeze): Optimize the way to update playerlist
    setInterval(() => {
      document.getElementById('playerlist').innerHTML = '';
      this.helper.gameState.getPlayers().forEach(playerID => {
        if (typeof playerID.displayName !== 'string' || !playerID.displayName.includes(document.getElementById("searchPlayer").value)) {
          return;
        }
        const playerDOM = template.cloneNode(true);
        playerDOM.setAttribute('id', playerID.playerID);
        playerDOM.setAttribute('data-player-context-menu', playerID.playerID);
        
        // Sanitize XSS
        const san_playerID = filterXSS(playerID.playerID);
        const san_displayName = filterXSS(playerID.displayName);


        playerDOM.setAttribute('onclick', 'startPrivateMessage(\'' + san_playerID + '\')');
        playerDOM.querySelector('.player-name').textContent = san_displayName;
        // TODO: get user role;
        playerDOM.querySelector('.player-role').textContent = 'unknown role';
        // TODO: get user picture;
        playerDOM.querySelector('.player-picture').setAttribute('src', 'https://via.placeholder.com/56x61');
        // TODO(zeze-zeze): Keep a record of dom elements
        // TODO(zeze-zeze): Move it to a separate function
        document.getElementById('playerlist').appendChild(playerDOM);
        // TODO(zeze-zeze): Use onchange callback to update playerlist instead of waiting 1 second
     });
    }, 1000);
  }
}

export default Client;
