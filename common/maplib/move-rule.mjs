import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');
const movingRequestThreshold = config.get('movingRequestThreshold');

class MoveRule{

  _getManhattanDistance(a,b){
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  sameMapCheck(mapCoord1,mapCoord2){
      return mapCoord1.mapName === mapCoord2.mapName;
  }

  borderCheck(coord,mapSize){
    if (coord.x >= mapSize.width || coord.x < 0) {
      return false;
    }
    if (coord.y >= mapSize.height || coord.y < 0) {
      return false;
    }
    return true;
  }

  nearbyGridCheck(coord,lastCoord){
    let distanceSquire = this._getManhattanDistance(lastCoord,coord);
    if (distanceSquire > 1) {
      return false;
    } 
    return true;
  }

  movementRequestSpeedCheck(playerData){
    if (playerData.lastMovingTime === undefined) {
      console.log('player has no last time record')
      return false;
    }
    if (Date.now() - playerData.lastMovingTime < movingRequestThreshold ){
      return false;
    }
    return true;
  }

  blockedCellCheck(gameMap, mapCoord){
    return gameMap.getCell(mapCoord,'wall');
  }
}

export default MoveRule;