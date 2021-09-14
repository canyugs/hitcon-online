// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const CONTEXT_MENU_OTHER_DIV = 'context-menu-other';
const CONTEXT_MENU_LIST_OTHER_UL = 'context-menu-list-other';
const CONTEXT_MENU_SELF_DIV = 'context-menu-self';
const CONTEXT_MENU_LIST_SELF_UL = 'context-menu-list-self';

const mapCellSize = 32;

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
        document.getElementById('mapcanvas').addEventListener('contextmenu', this.onContextMenu.bind(this));
        document.body.addEventListener('click', this.hideMenu);

        // Get current player
        window.addEventListener('gameStart', (d) => {
            this.playerInfo = d.detail.gameClient.playerInfo;
        });
    }

    /**
     * Called when user clicked on the player.
     * @param {Event} e event
     */
    onContextMenu(e) {
        e.preventDefault();

        // Check if the user actually clicked on a player.
        if (!this.findFocusedUser(e.pageX, e.pageY)) {
            return;
        }

        // Identify whether the menu is for the user itself or other players.
        // Stop if the menu is empty.
        let div;
        if (this.focusedPlayer.playerID === this.playerInfo.playerID && this.selfMenu.size > 0) {
            div = CONTEXT_MENU_SELF_DIV;
        } else if (this.focusedPlayer.playerID !== this.playerInfo.playerID && this.othersMenu.size > 0) {
            div = CONTEXT_MENU_OTHER_DIV;
        } else {
            this.focusedPlayer = null;
            return;
        }

        let menu = document.getElementById(div);
        if (menu.style.display == "block") {
            this.hideMenu();
        } else {
            menu.style.display = 'block';
            menu.style.left = e.pageX + "px";
            menu.style.top = e.pageY + "px";
        }

    }

    /**
     * Hide menu
     */
    hideMenu() {
        document.getElementById(CONTEXT_MENU_SELF_DIV).style.display = "none";
        document.getElementById(CONTEXT_MENU_OTHER_DIV).style.display = "none";
        this.focusedPlayer = null;
    }

    /**
     * Find the player at the specific position in the page, and assign to this.focusedPlayer
     * @param pageX Event.pageX
     * @param pageY Event.pageX
     * @returns {Boolean} Whether there exist a player at the position.
     */
    findFocusedUser(pageX, pageY) {
        const x = pageX - this.mapRenderer.canvas.offsetLeft;
        const y = pageY - this.mapRenderer.canvas.offsetTop;
        for (const player of this.gameState.players.values()) {
            const mapCoord = player.getDrawInfo()?.mapCoord;
            const canvasCoordinate = this.mapRenderer.mapToCanvasCoordinate(mapCoord);

            if (canvasCoordinate.x <= x &&
                canvasCoordinate.x + mapCellSize >= x &&
                canvasCoordinate.y >= y &&
                canvasCoordinate.y - mapCellSize <= y
            ) {
              this.focusedPlayer = player;
              return true;
            }
        }
        return false;
    }


    /**
     * Add a item to the context menu for other player.
     * @param {string} name The displayed name of the item.
     * @param {Function} callback A callback function which takes a Player object.
     */
    addToOthersMenu(name, callback) {
        this.othersMenu.set(name, callback);

        const newItemDOM = document.createElement('li');
        newItemDOM.setAttribute('id', `context-menu-others-${this.othersMenu.size}`);
        newItemDOM.innerHTML = `<a href="#">${name}</a></li>`;
        newItemDOM.addEventListener('click', () => {
            this.handleCallback(name, 'others');
        });

        document.getElementById(CONTEXT_MENU_LIST_OTHER_UL).appendChild(newItemDOM);
    }
    /**
     * Add a item to the context menu for oneself.
     * @param {string} name The displayed name of the item.
     * @param {Function} callback A callback function which takes a Player object.
     */
    addToSelfMenu(name, callback) {
        this.selfMenu.set(name, callback);

        const newItemDOM = document.createElement('li');
        newItemDOM.setAttribute('id', `context-menu-self-${this.selfMenu.size}`);
        newItemDOM.innerHTML = `<a href="#">${name}</a></li>`;
        newItemDOM.addEventListener('click', () => {
            this.handleCallback(name, 'self');
        });

        document.getElementById(CONTEXT_MENU_LIST_SELF_UL).appendChild(newItemDOM);
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