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
    this.template = document.getElementById('playerlist-player').cloneNode(true);
    this.playerList = {};    
  }

  async gameStart() {
    this.tab = new PlayerlistTab(this.helper.mainUI);
    this.initPlayerList();
    this.helper.gameState.registerOnPlayerUpdate(msg => this.syncPlayerList(msg));
    this.updatePlayerList();
  }

  /**
   * init the playlist from the server
   * @todo Get user role.
   * @todo Get user picture.
   */
  initPlayerList() {
    this.helper.gameState.getPlayers().forEach(player => {
      this.playerList[player.playerID] = {
        playerID : player.playerID, 
        displayName : player.displayName, 
        displayChar : player.displayChar
      }
    });
  }

  /**
   * Get the PlayerSyncMessage from server and update the playerList object.
   * @param {object} msg - The PlayerSyncMessage from server.
   * @todo Get user role.
   * @todo Get user picture.
   */
  syncPlayerList(msg) {
    if (msg.removed == true) {
      delete this.playerList[msg.playerID];
      return;
    }

    if (Object.keys(this.playerList).includes(msg.playerID) == false) {
      this.playerList[msg.playerID] = {
        playerID : msg.playerID, 
        displayName : msg.displayName, 
        displayChar : msg.displayChar
      }
    } else {
      return;
    }
  }

  /**
   * refresh the playerlist dom.
   * @updatePlayerList
   * @todo Get user role.
   * @todo Get user picture.
   */
  updatePlayerList() {
    setInterval(() => {
      document.getElementById('playerlist').innerHTML = '';
      for (const playerID of Object.keys(this.playerList)) {
        if (typeof this.playerList[playerID].displayName !== 'string' || !this.playerList[playerID].displayName.includes(document.getElementById("searchPlayer").value)) {
          continue;
        }
  
        const playerDOM = this.template.cloneNode(true);
        playerDOM.setAttribute('id', this.playerList[playerID].playerID);
        playerDOM.setAttribute('data-player-context-menu', this.playerList[playerID].playerID);
        playerDOM.setAttribute('onclick', 'startPrivateMessage(\'' + this.playerList[playerID].playerID + '\')');
        playerDOM.querySelector('.player-name').textContent = this.HTMLEncode(this.playerList[playerID].displayName);
        playerDOM.querySelector('.player-role').textContent = 'unknown role';
        playerDOM.querySelector('.player-picture').setAttribute('src', 'https://via.placeholder.com/56x61');
        document.getElementById('playerlist').appendChild(playerDOM);
      }
    }, 500);
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