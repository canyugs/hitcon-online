// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MAP_CELL_SIZE} from '/static/sites/game-client/map-renderer.mjs';

const CONTEXT_MENU_OTHER = 'context-menu-other';
const CONTEXT_MENU_SELF = 'context-menu-self';

/**
 * Maintain the state of the context menu for players.
*/
class ContextMenu {
  /**
   *
   */
  constructor(gameState, mapRenderer) {
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this.othersMenu = new Map();
    this.selfMenu = new Map();

    this.focusedPlayer = null;
    this.playerInfo = null;

    // bind the contextmenu and click event.
    $('#mapcanvas').on('contextmenu', this.canvasOnContextMenu.bind(this));
    $('body').on('contextmenu', '[data-player-context-menu]', this.elementOnContextMenu.bind(this));
    $('body').on('click', this.hideMenu);

    // Get current player
    window.addEventListener('dataReady', (d) => {
      this.playerInfo = d.detail.gameClient.playerInfo;
    });
  }

  /**
   * Called when user right-clicked on the player in the canvas.
   * @param {Event} e event
   */
  canvasOnContextMenu(e) {
    // Check if the user actually clicked on a player.
    this.focusedPlayer = this.findFocusedUser(e.pageX, e.pageY);
    e.preventDefault();
    this.onContextMenu(e);
  }

  /**
   * Called when user right-clicked on the elements with data-player-context-menu attribute.
   * @param {Event} e event
   */
  elementOnContextMenu(e) {
    // Check if the player exists.
    if (!this.gameState.players.has($(e.target).attr('data-player-context-menu'))) {
      return;
    }

    this.focusedPlayer = this.gameState.getPlayer($(e.target).attr('data-player-context-menu'));

    e.preventDefault();
    this.onContextMenu(e);
  }

  /**
   * Called when user right-clicked on the player in the canvas.
   * @param {Event} e event
   */
  onContextMenu(e) {
    // Identify whether the menu is for the user itself or other players.
    // Stop if the menu is empty or no focused player found.
    let elementPrefix;
    if (this.focusedPlayer == null) {
      return;
    } else if (this.focusedPlayer.playerID === this.playerInfo.playerID && this.selfMenu.size > 0) {
      elementPrefix = CONTEXT_MENU_SELF;
    } else if (this.focusedPlayer.playerID !== this.playerInfo.playerID && this.othersMenu.size > 0) {
      elementPrefix = CONTEXT_MENU_OTHER;
    } else {
      this.focusedPlayer = null;
      return;
    }

    let menu = document.getElementById(elementPrefix);

    // If the menu is already opened, closed it.
    if (document.getElementById(CONTEXT_MENU_SELF).style.display == "flex" ||
        document.getElementById(CONTEXT_MENU_OTHER).style.display == "flex") {
      this.hideMenu();
    }

    console.log(this.focusedPlayer);
    document.getElementById(elementPrefix + '-name').textContent = this.focusedPlayer.displayName;
    document.getElementById(elementPrefix + '-role').textContent = 'unknown role';

    // Open the menu
    menu.style.display = 'flex';
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
  }

  /**
   * Hide menu
   */
  hideMenu() {
    document.getElementById(CONTEXT_MENU_SELF).style.display = "none";
    document.getElementById(CONTEXT_MENU_OTHER).style.display = "none";
  }

  /**
   * Find the player at the specific position in the page, and assign to this.focusedPlayer
   * @param pageX Event.pageX
   * @param pageY Event.pageX
   * @returns {Player} The player object at the position.
   */
  findFocusedUser(pageX, pageY) {
    const x = pageX - this.mapRenderer.canvas.offsetLeft;
    const y = pageY - this.mapRenderer.canvas.offsetTop;
    for (const player of this.gameState.players.values()) {
      const mapCoord = player.getDrawInfo()?.mapCoord;
      const canvasCoordinate = this.mapRenderer.mapToCanvasCoordinate(mapCoord);

      if (canvasCoordinate.x <= x &&
        canvasCoordinate.x + MAP_CELL_SIZE >= x &&
        canvasCoordinate.y >= y &&
        canvasCoordinate.y - MAP_CELL_SIZE <= y
      ) {
        return player;
      }
    }
    return null;
  }


  /**
   * Add a item to the context menu for other player.
   * @param {string} name The displayed name of the item.
   * @param {string} icon The displayed icon of the item.
   * @param {Function} callback A callback function which takes a Player object.
   */
  addToOthersMenu(name, icon, callback) {
    this.othersMenu.set(name, callback);

    const newItemDOM = document.createElement('button');
    newItemDOM.setAttribute('id', `context-menu-others-${this.othersMenu.size}`);
    newItemDOM.setAttribute('class', 'context-menu-action');
    newItemDOM.innerHTML = `
      <div>${name}</div>
      <img src="${icon}" alt="">
    `;
    newItemDOM.addEventListener('click', () => {
      this.handleCallback(name, 'others');
    });

    document.getElementById(CONTEXT_MENU_OTHER + '-actions').appendChild(newItemDOM);
  }
  /**
   * Add a item to the context menu for oneself.
   * @param {string} name The displayed name of the item.
   * @param {string} icon The displayed icon of the item.
   * @param {Function} callback A callback function which takes a Player object.
   */
  addToSelfMenu(name, icon, callback) {
    this.selfMenu.set(name, callback);

    const newItemDOM = document.createElement('button');
    newItemDOM.setAttribute('id', `context-menu-self-${this.selfMenu.size}`);
    newItemDOM.setAttribute('class', 'context-menu-action');
    newItemDOM.innerHTML = `
      <div>${name}</div>
      <img src="${icon}" alt="">
    `;
    newItemDOM.addEventListener('click', () => {
      this.handleCallback(name, 'self');
    });

    document.getElementById(CONTEXT_MENU_SELF + '-actions').appendChild(newItemDOM);
  }

  /**
   * Handle the callback of the item.
   * @param name The name of the clicked item.
   * @param menuType others or self.
   */
  handleCallback(name, menuType) {
    if (menuType === 'others' && this.othersMenu.get(name)) {
      return this.othersMenu.get(name)(this.focusedPlayer);
    } else if (menuType === 'self' && this.selfMenu.get(name)) {
      return this.selfMenu.get(name)(this.focusedPlayer);
    }
  }

}

export default ContextMenu;
