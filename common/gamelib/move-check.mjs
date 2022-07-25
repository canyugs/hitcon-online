// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const PLAYER_MOVE_TIME_INTERVAL = 100; // ms
const PLAYER_MOVE_DISTANCE_LIMIT = 1; // cell

// const movementLogger = console;
const movementLogger = {debug: () => {}};

/**
 * TODO
 * @param {Player} oldPlayerData - TODO
 * @param {PlayerSyncMessage} updateMessage - TODO
 * @param {GameMap} gameMap - TODO
 * @param {Boolean} clientSide - `true` if speed check uses Player.lastMovingTimeClient.
 * @return {Boolean}
 */
function checkPlayerMove(oldPlayerData, updateMessage, gameMap, clientSide=false) {
  if (!_speedCheck(oldPlayerData, updateMessage, clientSide)) {
    movementLogger.debug('- speed check failed');
    return false;
  }
  if (!_borderAndWallCheck(oldPlayerData, updateMessage, gameMap)) {
    movementLogger.debug('- border and wall check failed');
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
  const lastMovingTime = (clientSide) ? oldPlayerData.lastMovingTimeClient : oldPlayerData.lastMovingTime;
  if (Date.now() < lastMovingTime + PLAYER_MOVE_TIME_INTERVAL) {
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

/**
 * This check is used only on client side.
 * Check if the target position contains other players.
 * @param {MapCoord} coord
 * @param {GameState} gameState
 * @return {Boolean}
 */
function checkOccupationOnClient(coord, gameState) {
  for (const op of gameState.getPlayers().values()) {
    if (coord.equalsTo(op.mapCoord)) {
      return false;
    }
  }
  return true;
}

export {
  movementLogger,
  checkPlayerMove,
  checkPlayerMoveOnlyBorderAndWall,
  checkPlayerMoveOnlySpeed,
  getPlayerMoveCooldown,
  checkOccupationOnClient,
  PLAYER_MOVE_TIME_INTERVAL,
  PLAYER_MOVE_DISTANCE_LIMIT,
};
