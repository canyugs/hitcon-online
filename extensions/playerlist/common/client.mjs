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
    // The cache for each of the player's entry in the player list.
    // Keyed by playerID, value is an object with the following:
    // dom - The DOM.
    // displayName - The current display name that is being shown.
    // Note that we need this because DOM access could be expensive.
    this.doms = new Map();
  }

  async gameStart() {
    this.tab = new PlayerlistTab(this.helper.mainUI);

    this.syncPlayerList(true);
    this.helper.gameState.registerOnPlayerUpdate((msg) => {
      this.handlePlayerUpdate(msg);
    });
    // Periodically ensure that the list is correct.
    setInterval(() => {
      this.syncPlayerList(false);
    }, 60*1000);
  }

  /**
   * Process the update player event to update the player list.
   */
  handlePlayerUpdate(msg) {
    if (msg.removed) {
      this.removePlayer(msg.playerID);
      return;
    }

    const p = this.helper.gameState.getPlayer(msg.playerID);
    if (p) {
      this.syncPlayer(p);
    } else {
      console.warn(`Got invalid player obj for ${msg.playerID} in playerlist.handlePlayerUpdate: `, p);
    }
  }

  /**
   * Synchronize the player list to the entire gameState data.
   */
  async syncPlayerList(firstTry) {
    const players = this.helper.gameState.getPlayers();
    Array.from(this.doms.keys()).filter((k) => { return !(players.has(k)); })
      .forEach((playerID) => {
        // Usually this should not happen.
        console.warn('Removing player in syncPlayer: ', playerID);
        this.removePlayer(playerID);
      });
    Array.from(players.keys()).forEach((playerID) => {
      const ret = this.syncPlayer(players.get(playerID));
      if (ret && !firstTry) {
        // Usually this should not happen.
        console.warn('Updating player in syncPlayerList: ', playerID);
      }
    });
  }

  /**
   * Ensure that the given player's information is correct in the player list.
   * @return {Boolean} modified - True if modified.
   */
  syncPlayer(p) {
    if (!(this.doms.has(p.playerID))) {
      // Create the DOM.
      this.createPlayer(p);
      return true;
    }
    let modified = false;
    const cached = this.doms.get(p.playerID);
    if (cached.displayName !== p.displayName) {
      // Need to update the displayName.
      cached.dom.querySelector('.player-name').textContent = p.displayName;
      cached.displayName = p.displayName;
      modified = true;
    }
    return modified;
  }

  /**
   * Add a player to the player list.
   */
  createPlayer(p) {
    const dom = document.getElementById('playerlist-player').cloneNode(true);
    dom.setAttribute('id', `playerlist-entry-${p.playerID}`);
    dom.setAttribute('data-player-context-menu', p.playerID);

    const cached = {};
    cached.dom = dom;
    cached.dom.querySelector('.player-name').textContent = p.displayName;
    cached.displayName = p.displayName;

    cached.dom.querySelector('.player-role').textContent = '';
    cached.dom.querySelector('.player-picture').setAttribute('src', 'https://via.placeholder.com/56x61');

    document.getElementById('playerlist').appendChild(cached.dom);
    this.doms.set(p.playerID, cached);
  }

  /**
   * Remove a player from the player list.
   */
  removePlayer(playerID) {
    if (!(this.doms.has(playerID))) {
      // Already removed.
      return;
    }
    const cached = this.doms.get(playerID);
    this.doms.delete(playerID);

    cached.dom.remove();
  }
}

export default Client;
