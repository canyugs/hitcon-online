// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

/**
 * TODO: jsdoc
 */
class InteractiveObjectClientBaseClass {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   * @param {MapCoord} initialPosition - TODO
   * @param {Object} clientInfo - Information regrading this interactive object
   *   that the client side should know. It should contain:
   *   - {MapCoord} initialPosition - NPC's initial position.
   *   - {Object} displayConfig - Arguments for drawing this NPC.
   * @param {Function} interactFunction - The function to be called when the user tries to
   * interact with this object (on click, keydown, signal, etc.)
   */
  constructor(helper, clientInfo, interactFunction) {
    this.helper = helper;
    this.clientInfo = clientInfo;
    this.mapCoord = clientInfo.initialPosition;
    this.displayConfig = clientInfo.displayConfig;
    this.interactFunction = interactFunction;
    this.objectName = clientInfo.objectName;
    this.distanceLimit = clientInfo.distanceLimit;
    this.interactType = clientInfo.interactType;

    for (const conf of this.displayConfig) {
      const {zIndex, layerName, renderFunction, renderArgs} = conf;
      this.helper.mapRenderer.registerCustomizedLayerToDraw(zIndex, layerName, renderFunction, renderArgs);
    }

    if (this.interactType === 'click') {
      // interact on click
      // TODO: use `class InteractiveObjectManager` to handle the callback.
      // `InteractiveObjectManager.lookupTable` is a Map() whose key and value are coordinate and callback, respectively.
      // In this way, there will be only one callback in InputManager and InteractiveObjectManager will find the
      // respective callback in O(1) complexity.
      this.helper.inputManager.registerCanvasOnClickMapCoord((clickedMapCoord) => {
        // determine whether this object is clicked
        const {x: cx, y: cy} = clickedMapCoord;
        const {x, y} = this.mapCoord;
        if (clickedMapCoord.mapName != this.mapCoord.mapName) return;
        if (!(x <= cx && cx < x+1 && y <= cy && cy < y+1)) return;

        this.onInteract();
      });
    } else {
      this.helper.gameState.registerOnPlayerUpdate((msg) => {
        if (msg.ghostMode === true) {
          // Ignore ghost mode updates.
          return;
        }
        const p = this.helper.getSelfPlayerID();
        if (typeof p !== 'string') {
          console.warn('Game not started when player update triggered', msg);
          return;
        }
        if (msg.playerID !== p) {
          // Not the current player.
          return;
        }
        if (msg.mapCoord !== undefined && msg.mapCoord.equalsTo(this.mapCoord)) {
          // We hit the user.
          this.onInteract();
        }
      });
    }

    // TODO: interact on keydown
  }

  /**
   * Return the interactive object's MapCoord.
   */
  getPosition() {
    // Interactive objects can't move, for now.
    return this.mapCoord;
  }

  /**
   * Called when player wants to interact.
   */
  async onInteract() {
    const playerID = this.helper.getSelfPlayerID();
    if (typeof playerID !== 'string') {
      console.warn(`Attempting to interact with ${this.clientInfo.name} before game start`);
      console.trace();
      return;
    }
    const loc = await this.helper.getPlayerLocation(playerID);
    if (typeof loc !== 'object') {
      console.warn('Unable to fetch self location: ', loc);
      return;
    }

    if (Number.isInteger(this.distanceLimit) && loc.distanceTo1(this.getPosition()) > this.distanceLimit) {
      console.warn(`Player ${playerID} is interacting with ${this.objectName} from too far away`);
      // Notify the user.
      this.helper.mainUI.showNotification('You need to come closer to interact');
      //return false;
    }
    this.interactFunction();
  }
}

export default InteractiveObjectClientBaseClass;
