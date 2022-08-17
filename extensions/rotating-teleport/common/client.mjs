// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

const LAYER_NAME = 'rotatingTeleport';
const SEPARATOR = '.';
const ACTION_IN = 'in';
const ACTION_OUT = 'out';

const ROTATE_HALF_DURATION = 3; // unit: sec
const ROTATE_ANGULAR_ACCELERATION = 360; // unit: deg / (sec^2)
const ROTATE_TIME_FORWARD = 0;
const ROTATE_TIME_BACKWARD = 1;
const ROTATE_PHASE_FORWARD = 0;
const ROTATE_PHASE_BACKWARD = 1;
const ROTATE_PHASE_END = 2;


/**
 * The object that deals with the parameters for rotating animation.
 */
class Rotator {
  /**
   * @param {Number} zeroAngle - unit: deg
   * @param {Number} time - ROTATE_TIME_FORWARD or ROTATE_TIME_BACKWARD
   */
  constructor(zeroAngle, time=ROTATE_TIME_FORWARD) {
    this.t0 = null;
    this.x0 = zeroAngle;
    this.forwardTime = (time === ROTATE_TIME_FORWARD);
  }

  start() {
    this.t0 = Date.now() / 1000;
  }

  getStatus() {
    const dt = Date.now() / 1000 - this.t0;
    const dt2 = (this.forwardTime) ?
        dt * dt :
        (ROTATE_HALF_DURATION - dt) * (ROTATE_HALF_DURATION - dt);
    return {
      end: dt >= ROTATE_HALF_DURATION,
      angle: this.x0 + ROTATE_ANGULAR_ACCELERATION * dt2,
    };
  }

  static angle2direction(angle) {
    const normalizedAngle = (0 <= angle && angle < 360) ? angle : ((angle % 360 + 360) % 360);
    if (45 <= normalizedAngle && normalizedAngle < 135) return 'U';
    if (135 <= normalizedAngle && normalizedAngle < 225) return 'L';
    if (225 <= normalizedAngle && normalizedAngle < 315) return 'D';
    return 'R';
  }

  static direction2angle(direction) {
    switch (direction) {
      case 'U':
        return 90;
      case 'L':
        return 180;
      case 'D':
        return 270;
      default:
        return 0;
    }
  }
}


/**
 * TODO: jsdoc
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
    this.teleportLookupTable = new Map(); // key: the ID of the portal, value: the destination

    // If the player is being teleported, then there would be an entry in this map.
    // key: playerID, value: the target place of teleportation
    this.isBeingTeleported = new Map();
  }

  /**
   * The initialization function.
   */
  async gameStart() {
    this.parseLayer();

    // teleport the player if he/she steps on a portal
    this.helper.gameState.registerOnPlayerUpdate((msg) => {
      if (typeof msg.playerID !== 'string') return;
      if (typeof msg.mapCoord !== 'object') return;

      // if he/she is not being teleported, check if steps on a portal defined by our extension
      const layerValue = this.helper.gameMap.getCell(msg.mapCoord, LAYER_NAME);
      if (layerValue === null) return;
      const [id, action] = layerValue.split(SEPARATOR);
      if (action !== ACTION_IN) return;

      // rotating teleport
      const fromPlace = this.helper.gameState.getPlayer(msg.playerID).mapCoord.copy();
      const targetPlace = this.teleportLookupTable.get(id);
      this.tryStartRotatingTeleportAnimation(msg.playerID, fromPlace, targetPlace);
    });
  }

  /**
   * Parse the configuration
   * @return {Boolean} - successful or not
   */
  parseLayer() {
    // parse the layers and build the lookup table
    const inIDs = new Set();
    for (const [mapName, map] of this.helper.gameMap.getMaps()) {
      const {width, height} = map.getMapSize();
      for (let x = 0; x < width; ++x) {
        for (let y = 0; y < height; ++y) {
          const coord = new MapCoord(mapName, x, y);
          const layerValue = map.getCell(coord, LAYER_NAME);
          if (layerValue === null) continue;
          console.assert(typeof layerValue === 'string');
          const [id, action] = layerValue.split(SEPARATOR);
          switch (action) {
            case ACTION_IN:
              inIDs.add(id);
              break;
            case ACTION_OUT:
              this.teleportLookupTable.set(id, coord);
              break;
            default:
              console.error(`[rotating-teleport] invalid layer value ${layerValue}`);
          }
        }
      }
    }
    // check
    if (inIDs.size !== this.teleportLookupTable.size) {
      console.error(`[rotating-teleport] has ${inIDs.size} 'in' portal but has ${this.teleportLookupTable.size} 'out' portal`);
      return false;
    }
    for (const id of inIDs) {
      if (!this.teleportLookupTable.has(id)) {
        console.error(`[rotating-teleport] missing 'out' portal of 'in' portal ${id}`);
        return false;
      }
    }

    return true;
  }

  /**
   * @param {String} playerID
   * @param {MapCoord} fromPlace
   * @param {MapCoord} targetPlace
   */
  async s2c_tryStartRotatingTeleportAnimation(playerID, fromPlace, targetPlace) {
    this.tryStartRotatingTeleportAnimation(playerID, fromPlace, targetPlace);
  }

  /**
   * @param {String} playerID
   * @param {MapCoord} fromPlace
   * @param {MapCoord} targetPlace
   */
  tryStartRotatingTeleportAnimation(playerID, fromPlace, targetPlace) {
    // if the player is being teleported, update the destination
    if (this.isBeingTeleported.has(playerID)) {
      this.isBeingTeleported.set(playerID, targetPlace);
      return;
    }

    // create a new object to prevent from polluting the source object
    targetPlace = MapCoord.fromObject(targetPlace);

    // save the destination
    this.isBeingTeleported.set(playerID, targetPlace);

    const player = this.helper.gameState.getPlayer(playerID);
    const initAngle = Rotator.direction2angle(player.facing);
    let phase = ROTATE_PHASE_FORWARD;
    let rotator = new Rotator(initAngle, ROTATE_TIME_FORWARD);
    rotator.start();

    player.setCustomGetDrawInfo((player_) => {
      if (phase === ROTATE_PHASE_FORWARD) {
        const {end, angle} = rotator.getStatus();
        if (end) {
          rotator = new Rotator(initAngle, ROTATE_TIME_BACKWARD);
          rotator.start();
          phase = ROTATE_PHASE_BACKWARD;
        }
        return {
          mapCoord: fromPlace,
          facing: Rotator.angle2direction(angle),
        };
      }

      if (phase === ROTATE_PHASE_BACKWARD) {
        const {end, angle} = rotator.getStatus();
        if (end) {
          phase = ROTATE_PHASE_END;
          this.isBeingTeleported.delete(playerID);
        }
        return {
          mapCoord: targetPlace,
          facing: Rotator.angle2direction(angle),
        };
      }

      return {};
    });
  }
}

export default Client;
