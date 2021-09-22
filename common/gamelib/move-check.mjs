// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const PLAYER_MOVE_TIME_INTERVAL = 300; // ms
const PLAYER_MOVE_DISTANCE_LIMIT = 1; // cell

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} newPlayerData - TODO
 * @param {GameMap} gameMap - TODO
 * @return {Boolean}
 */
function checkPlayerMove(oldPlayerData, newPlayerData, gameMap) {
  let canMove = true;
  canMove = canMove && _speedCheck(oldPlayerData, newPlayerData);
  canMove = canMove && _borderAndWallCheck(oldPlayerData, newPlayerData, gameMap);
  return canMove;
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} newPlayerData - TODO
 * @return {Boolean}
 */
function _speedCheck(oldPlayerData, newPlayerData) {
  // check time
  if (Date.now() < oldPlayerData.lastMovingTime + PLAYER_MOVE_TIME_INTERVAL) {
    return false;
  }

  // check distance
  if (oldPlayerData.mapCoord.distanceTo1(newPlayerData.mapCoord) > PLAYER_MOVE_DISTANCE_LIMIT) {
    return false;
  }

  return true;
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} newPlayerData - TODO
 * @param {GameMap} gameMap - TODO
 * @return {Boolean}
 */
function _borderAndWallCheck(oldPlayerData, newPlayerData, gameMap) {
  // check wall
  // TODO: check all the map coordinates between old position and new position
  if (gameMap.getCell(newPlayerData.mapCoord, 'wall')) {
    return false;
  }

  // check border
  const {width, height} = gameMap.getMapSize(newPlayerData.mapCoord.mapName);
  const {x, y} = newPlayerData.mapCoord;
  if (!(0 <= x && x <= width && 0 <= y && y <= height)) {
    return false;
  }

  return true;
}

export {checkPlayerMove,
  PLAYER_MOVE_TIME_INTERVAL,
  PLAYER_MOVE_DISTANCE_LIMIT,
};
