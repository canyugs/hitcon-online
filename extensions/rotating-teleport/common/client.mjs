// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '/static/common/maplib/map.mjs';

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
  }

  /**
   * The initialization function.
   */
  async gameStart() {
    // If the player is being teleported, then there would be an entry in this map.
    // key: playerID, value: the target place of teleportation
    this.isBeingTeleported = new Map();
  }

  onExtensionBroadcast(kwargs) {
    const {playerID, fromPlace, toPlace} = kwargs;
    this.tryStartRotatingTeleportAnimation(playerID, fromPlace, toPlace);
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
    fromPlace = MapCoord.fromObject(fromPlace);

    // save the destination
    this.isBeingTeleported.set(playerID, targetPlace);

    const player = this.helper.gameState.getPlayer(playerID);
    const initAngle = Rotator.direction2angle(player.facing);
    let phase = ROTATE_PHASE_FORWARD;
    let rotator = new Rotator(initAngle, ROTATE_TIME_FORWARD);
    rotator.start();

    player.setCustomGetDrawInfo((player_) => {
      // TODO: move the ViewerPosition smoothly

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
