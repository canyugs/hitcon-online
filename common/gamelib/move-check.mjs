// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const PLAYER_MOVE_TIME_INTERVAL = 100; // ms
const PLAYER_MOVE_DISTANCE_LIMIT = 1; // cell

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {GameMap} gameMap - TODO
 * @return {Boolean}
 */
function checkPlayerMove(oldPlayerData, updateMessage, gameMap) {
  let canMove = true;
  canMove = canMove && _speedCheck(oldPlayerData, updateMessage);
  canMove = canMove && _borderAndWallCheck(oldPlayerData, updateMessage, gameMap);
  return canMove;
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @return {Boolean}
 */
function _speedCheck(oldPlayerData, updateMessage) {
  // check time
  if (Date.now() < oldPlayerData.lastMovingTime + PLAYER_MOVE_TIME_INTERVAL) {
    return false;
  }

  // check distance
  if (oldPlayerData.mapCoord.distanceTo1(updateMessage.mapCoord) > PLAYER_MOVE_DISTANCE_LIMIT) {
    return false;
  }

  return true;
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {GameMap} gameMap - TODO
 * @return {Boolean}
 */
function _borderAndWallCheck(oldPlayerData, updateMessage, gameMap) {
  // check border
  const {width, height} = gameMap.getMapSize(updateMessage.mapCoord.mapName);
  const {x, y} = updateMessage.mapCoord;
  if (!(0 <= x && x <= width && 0 <= y && y <= height)) {
    return false;
  }

  // check wall
  // TODO: check all the map coordinates between old position and new position
  if (gameMap.getCell(updateMessage.mapCoord, 'wall')) {
    return false;
  }

  return true;
}

export {checkPlayerMove,
  PLAYER_MOVE_TIME_INTERVAL,
  PLAYER_MOVE_DISTANCE_LIMIT,
};
