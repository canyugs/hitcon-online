// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');
const movingRequestThreshold = config.get('movingRequestThreshold');


/**
 * This class collect rules should be checked
 * before every user movement.
 * It could be call by server side and client side
 */
class MoveRule{

  constructor(gameMap){
    this.gameMap = gameMap;
  }

  /**
   * get Manhattan Distance between two MapCoord
   * @param {a} MapCoord - Object represent coord .
   * @param {b} MapCoord - The MapCoord of the second map .
   */
  _getManhattanDistance(a,b){
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  /**
   * check two MapCoord are in the same map
   * @param {mapCoord1} MapCoord - The MapCoord of the first map .
   * @param {mapCoord2} MapCoord - The MapCoord of the second map .
   */
  sameMapCheck(mapCoord1,mapCoord2){
      return mapCoord1.mapName === mapCoord2.mapName;
  }

  /**
   * check target coord is in the border of the map
   * @param {mapCoord1} MapCoord - The MapCoord of the first map .
   * @param {mapName} string - the name of the map .
   */
  borderCheck(coord,mapName){
    const mapSize = this.gameMap.getMapSize(mapName)
    if (coord.x >= mapSize.width || coord.x < 0) {
      return false;
    }
    if (coord.y >= mapSize.height || coord.y < 0) {
      return false;
    }
    return true;
  }

   /**
   * check target coord is in the map
   * @param {coord} MapCoord - The target MapCoord of user movement .
   * @param {lastCoord} MapCoord - The last MapCoord is stored in the server or client .
   */
  nearbyGridCheck(coord,lastCoord){
    let distanceSquire = this._getManhattanDistance(lastCoord,coord);
    if (distanceSquire > 1) {
      return false;
    } 
    return true;
  }

  /**
   * restric user movement frequency
   * @param {lastMovingTime} timeStamp - last time user request movement .
   */
  movementRequestSpeedCheck(lastMovingTime){
    if (Date.now() - lastMovingTime < movingRequestThreshold ){
      return false;
    }
    return true;
  }

  /**
   * restric user movement frequency
   * @param {lastMovingTime} timeStamp - last time user request movement .
   */
  blockedCellCheck(mapCoord,gameMap){
    return gameMap.getCell(mapCoord,'wall');
  }
}

export default MoveRule;