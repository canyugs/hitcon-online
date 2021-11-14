// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const PLAYER_MOVE_TIME_INTERVAL = 100; // ms
const PLAYER_MOVE_DISTANCE_LIMIT = 1; // cell

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {GameMap} gameMap - TODO
 * @param {Boolean} clientSide - `true` if speed check uses Player.lastMovingTimeClient.
 * @return {Boolean}
 */
function checkPlayerMove(oldPlayerData, updateMessage, gameMap, clientSide=false) {
  let canMove = true;
  canMove = canMove && _speedCheck(oldPlayerData, updateMessage, clientSide);
  canMove = canMove && _borderAndWallCheck(oldPlayerData, updateMessage, gameMap);
  return canMove;
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {GameMap} gameMap - TODO
 * @return {Boolean}
 */
function checkPlayerMoveOnlyBorderAndWall(oldPlayerData, updateMessage, gameMap) {
  return _borderAndWallCheck(oldPlayerData, updateMessage, gameMap);
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {Boolean} clientSide - `true` if speed check uses Player.lastMovingTimeClient.
 * @return {Boolean}
 */
function checkPlayerMoveOnlySpeed(oldPlayerData, updateMessage, clientSide=false) {
  return _speedCheck(oldPlayerData, updateMessage, clientSide);
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @return {Number} Remaining cooldown in millisecond.
 */
function getPlayerMoveCooldown(oldPlayerData) {
  return oldPlayerData.lastMovingTime + PLAYER_MOVE_TIME_INTERVAL - Date.now();
}

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {Boolean} clientSide - `true` if speed check uses Player.lastMovingTimeClient.
 * @return {Boolean}
 */
function _speedCheck(oldPlayerData, updateMessage, clientSide) {
  // check time
  const lmt = (clientSide) ? oldPlayerData.lastMovingTimeClient : oldPlayerData.lastMovingTime;
  if (Date.now() < lmt + PLAYER_MOVE_TIME_INTERVAL) {
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
  if (!(0 <= x && x < width && 0 <= y && y < height)) {
    return false;
  }

  // check wall
  // TODO: check all the map coordinates between old position and new position
  if (gameMap.getCell(updateMessage.mapCoord, 'wall')) {
    return false;
  }

  // check wall
  // TODO: check all the map coordinates between old position and new position
  if (gameMap.getCell(updateMessage.mapCoord, 'wall')) {
    return false;
  }

  return true;
}

export {
  checkPlayerMove,
  checkPlayerMoveOnlyBorderAndWall,
  checkPlayerMoveOnlySpeed,
  getPlayerMoveCooldown,
  PLAYER_MOVE_TIME_INTERVAL,
  PLAYER_MOVE_DISTANCE_LIMIT,
};
