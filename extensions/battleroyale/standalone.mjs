// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {MapCoord} from '../../common/maplib/map.mjs';
import {LAYER_BULLET, LAYER_OBSTACLE, LAYER_FIRE, BULLET_COOLDOWN} from './common/client.mjs';
import CellSet from '../../common/maplib/cellset.mjs';
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const alarm = require('alarm');
const config = require('config');

const BULLET_SPEED = 100; // ms per block (lower -> quicker)
const BULLET_LIFE = 5; // five blocks
const MAP_UPDATE_PERIOD = 3000; // ms per update
const START_GAME_INTERVAL = 3600_000; // millisecond

const Facing2Direction = {
  'U': [0, 1],
  'D': [0, -1],
  'R': [1, 0],
  'L': [-1, 0],
};

/**
 * This represents the bullet of battleroyale extension.
 */
class Bullet {
  /**
   * @constructor
   * @param {Number} ID
   * @param {String} facing
   * @param {MapCoord} mapCoord
   */
  constructor(ID, facing, mapCoord) {
    this.ID = ID;
    this.facing = facing;
    this.mapCoord = mapCoord;
    this.duration = 0;
    this.intervalID = undefined;
    this.mapCoord.x += Facing2Direction[this.facing][0]; // move one
    this.mapCoord.y += Facing2Direction[this.facing][1];
  }

  /**
   * update the bullet coord
   * @return {undefined}
   */
  updateCoord() {
    this.mapCoord.x += Facing2Direction[this.facing][0];
    this.mapCoord.y += Facing2Direction[this.facing][1];
    this.duration += 1;
  }

  /**
   * delete the interval
   * @return {undefined}
   */
  deleteInterval() {
    if (this.intervalID !== undefined) {
      clearInterval(this.intervalID);
      this.intervalID = undefined;
    }
  }
}

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    // get the default arena of every map
    this.arenaOfMaps = this.helper.gameMap.getOriginalCellSetStartWith('battleroyaleArena');
    
    this.bullets = new Map(); // key: bullet ID; value: Bullet
    this.bulletID = 0;

    this.fires = new Set(); // {x,y,w,h} objects

    for (const mapName of this.arenaOfMaps.keys()) {
      await this.helper.broadcastCellSetUpdateToAllUser(
          'set',
          mapName,
          CellSet.fromObject({
            name: LAYER_BULLET.layerName,
            priority: LAYER_BULLET.zIndex,
            cells: Array.from(this.bullets.values()),
            layers: {[LAYER_BULLET.layerName]: 'BB'},
            dynamic: true,
          }),
      );
      await this.helper.broadcastCellSetUpdateToAllUser(
          'set',
          mapName,
          CellSet.fromObject({
            name: LAYER_FIRE.layerName,
            priority: LAYER_FIRE.zIndex,
            cells: Array.from(this.fires),
            layers: {[LAYER_FIRE.layerName]: 'BF'},
            dynamic: true,
          }),
      );
    }

    this.cooldown = new Set();
    this.fireCounter = 0;
    this.gameStarted = false;
    this.updateMapIntervalIDs = [];
    this.participatePlayerIDs = new Set(); // store playerID
    this.playerOldPosition = new Map(); // [string, mapCoord] store player's position before tp to game

    await this.helper.gameState.registerOnPlayerUpdate((msg) => {
      try {
        this.onPlayerUpdate(msg);
      } catch (e) {
        console.error('battleroyale register player update listener failed: ', e, e.stack);
      }
    });

    // register state functions for NPC
    await this.helper.callS2sAPI('npc', 'registerStateFunc');
    const initTime = new Date();
    const startTime = new Date(Math.floor((+initTime + START_GAME_INTERVAL - 1) / START_GAME_INTERVAL) * START_GAME_INTERVAL + START_GAME_INTERVAL/2);
    alarm(startTime, this.setGameInterval.bind(this));

    // get config from default
    if (config.has('battleroyale.arena')) {
      this.arenaPos = config.get('battleroyale.arena');
    } else {
      // default position
      this.arenaPos = {x: 25, y: 25};
    }
  }

  /**
   * Game interval
   */
  setGameInterval() {
    alarm.recurring(START_GAME_INTERVAL, this.startGame.bind(this));
  }

  /**
   * start Game
   * @return {Boolean} success or not
   */
  async startGame() {
    if (this.gameStarted) {
      await this.resetGame();
    }
    if (this.participatePlayerIDs.size < 2) {
      for (const playerID of this.participatePlayerIDs) {
        await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[battleroyale] player not enough to start (less than 3)');
      }
      return false;
    }
    for (const playerID of this.participatePlayerIDs) {
      const playerloc = await this.helper.getPlayerLocation(playerID);
      this.playerOldPosition.set(playerID, playerloc);
      await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[battleroyale] Game Start!');
      await this.teleportPlayer(playerID);
    }

    this.gameStarted = true;
    const updateMap = setInterval(async () => {
      for (const mapName of this.arenaOfMaps.keys()) {
        const needUpdate = this.updateEdge(
            this.fires, this.arenaOfMaps.get(mapName), this.fireCounter,
        );
        if (!needUpdate) {
          clearInterval(updateMap);
          return;
        }
        await this.helper.broadcastCellSetUpdateToAllUser(
            'update',
            mapName,
            CellSet.fromObject({
              name: LAYER_FIRE.layerName,
              cells: Array.from(this.fires),
            }),
        );
        const players = this.helper.gameState.getPlayers();
        players.forEach(async (player, playerID) => {
          if (this.helper.gameMap.getCell(player.mapCoord, LAYER_FIRE.layerName)) {
            await this.killPlayer(playerID);
          }
        });
        this.fireCounter++;
        this.fires.clear();
      }
    }, MAP_UPDATE_PERIOD);
    this.updateMapIntervalIDs.push(updateMap);

    return true;
  }

  /**
   * Given a Coordinate, return inside battleroyale arena or not
   * @param {MapCoord} cellCoord - The cell position.
   * @return {Boolean} inside or not
   */
  insideMap(cellCoord) {
    const cellsets = this.arenaOfMaps.get(cellCoord.mapName);
    return cellsets.some((cellset) => cellset.containsMapCoord(cellCoord));
  }

  /**
   * Client tries to shoot bullet in front(depends on facing) of mapCoord.
   * The server returns true on success.
   * @param {Object} player - (TODO: needs docs)
   * @param {MapCoord} mapCoord - The bullet position.
   * @param {String} facing - The bullet facing.
   * @return {Boolean} success or not
   */
  async c2s_attack(player, mapCoord, facing) {
    if (!this.participatePlayerIDs.has(player.playerID)) return;
    mapCoord = MapCoord.fromObject(mapCoord);
    // mapCoord has to be inside an arena
    // TODO: use the utility function in maplib if there is such function
    const inside = this.insideMap(mapCoord);
    if (!inside || !this.gameStarted) return false;
    // ghost mode no attack
    // if (this.helper.gameState.getPlayer(player.playerID).ghostMode) return false;

    if (this.cooldown.has(player.playerID)) return false;
    this.cooldown.add(player.playerID);
    setTimeout(() => {
      this.cooldown.delete(player.playerID);
    }, BULLET_COOLDOWN);

    // create bullet

    const bulletID = this.bulletID++;
    const newBullet = new Bullet(bulletID, facing, mapCoord);

    // first tick die
    if (!this.insideMap(newBullet.mapCoord) ||
    this.helper.gameMap.getCell(newBullet.mapCoord, LAYER_OBSTACLE.layerName)) {
      return true;
    }
    const players = this.helper.gameState.getPlayers();
    players.forEach(async (player, playerID) => {
      if (newBullet.mapCoord.equalsTo(player.mapCoord)) {
        await this.killPlayer(playerID);
        return true;
      }
    });

    this.bullets.set(bulletID, newBullet);
    // render
    await this.helper.broadcastCellSetUpdateToAllUser(
        'update',
        mapCoord.mapName,
        CellSet.fromObject({
          name: LAYER_BULLET.layerName,
          cells: Array.from(
              this.bullets,
              ([_, v]) => v['mapCoord'],
          ),
        }),
    );

    // setInterval to update bullet
    newBullet.intervalID = setInterval(async (bulletID) => {
      const bullet = this.bullets.get(bulletID);
      bullet.updateCoord();
      if (bullet.duration >= BULLET_LIFE ||
          !this.insideMap(bullet.mapCoord) ||
          this.helper.gameMap.getCell(bullet.mapCoord, LAYER_OBSTACLE.layerName)) {
        bullet.deleteInterval();
        this.bullets.delete(bulletID);
        await this.helper.broadcastCellSetUpdateToAllUser(
            'update',
            mapCoord.mapName,
            CellSet.fromObject({
              name: LAYER_BULLET.layerName,
              cells: Array.from(
                  this.bullets,
                  ([_, v]) => v['mapCoord'],
              ),
            }),
        );
      } else {
        const playerMap = new Map();
        players.forEach((player, playerID) => {
          const {world, x, y} = player.mapCoord;
          playerMap.set(String(world)+'#'+String(x)+'#'+String(y), playerID);
        });
        for (const [bulletID, bullet] of this.bullets) {
          const {world, x, y} = bullet.mapCoord;
          const str = String(world)+'#'+String(x)+'#'+String(y);
          if (playerMap.has(str)) {
            await this.killPlayer(playerMap.get(str));
            bullet.deleteInterval();
            this.bullets.delete(bulletID);
            playerMap.delete(bullet.mapCoord);
          }
        }
        await this.helper.broadcastCellSetUpdateToAllUser(
            'update',
            mapCoord.mapName,
            CellSet.fromObject({
              name: LAYER_BULLET.layerName,
              cells: Array.from(
                  this.bullets,
                  ([_, v]) => v['mapCoord'],
              ),
            }),
        );
      }
    }, BULLET_SPEED, bulletID);

    return true;
  }

  /**
   * Given a gameMap return all edge
   * @param {Set} fires the fire Set
   * @param {Map} cellSets the maps
   * @param {Number} fireCounter count edge width
   * @return {Boolean} need further update or not
   */
  updateEdge(fires, cellSets, fireCounter) {
    let noUpdateCounter = 0; let totalCell = 0;
    for (const {cells} of cellSets) {
      for (const {x, y, w, h} of cells) {
        const wbound = Math.min(fireCounter, Math.floor(w/2));
        const hbound = Math.min(fireCounter, Math.floor(h/2));
        totalCell++;
        if (wbound === Math.floor(w/2) && hbound === Math.floor(h/2)) {
          noUpdateCounter++;
        }
        fires.add({x, y, w, h: hbound});
        fires.add({x, y: y+h-hbound, w, h: hbound});
        fires.add({x, y, w: wbound, h});
        fires.add({x: x+w-wbound, y, w: wbound, h});
      }
    }
    return noUpdateCounter != totalCell;
  }

  /**
   *
   * @param {Object} msg
   * @return {undefined}
   */
  async onPlayerUpdate(msg) {
    const {mapCoord, playerID} = msg;

    if (typeof playerID !== 'string') {
      console.warn('Invalid PlayerSyncMessage with non-string msg.playerID', msg, msg.playerID);
      return;
    }
    if (mapCoord === 'undefined') {
      // No location? Just skip.
      return;
    }

    const bullets = this.helper.gameMap.getCell(mapCoord, LAYER_BULLET.layerName);
    if (bullets) {
      await this.killPlayer(playerID);
      return;
    }

    const fire = this.helper.gameMap.getCell(mapCoord, LAYER_FIRE.layerName);
    if (fire) {
      await this.killPlayer(playerID);
      return;
    }

    return;
  }

  /**
   * kill player and tp
   * @param {String} playerID player ID
   * @param {Boolean} endGame kill player and terminate
   */
  async killPlayer(playerID, endGame = false) {
    if (!this.participatePlayerIDs.has(playerID)) return;
    let target;
    if (this.playerOldPosition.has(playerID)) {
      target = this.playerOldPosition.get(playerID);
    } else { // default
      const player = this.helper.gameState.getPlayer(playerID);
      target = player.mapCoord.copy();
      target.x = 1;
      target.y = 1;
    }
    await this.helper.teleport(playerID, target, true);
    this.playerOldPosition.delete(playerID);
    this.participatePlayerIDs.delete(playerID);
    if (this.participatePlayerIDs.size <= 1 && !endGame) {
      await this.terminateGame();
    }
  }

  /**
   * @param {String} playerID playerID
   */
  async teleportPlayer(playerID) {
    const player = this.helper.gameState.getPlayer(playerID);
    const target = player.mapCoord.copy();
    target.x = this.arenaPos.x;
    target.y = this.arenaPos.y;
    await this.helper.teleport(playerID, target, true);
  }

  /**
   * game is over give trophy and quit
   */
  async terminateGame() {
    for (const playerID of this.participatePlayerIDs) {
      await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[battleroyale] You Win!');
      // TODO: give item
    }

    for (const playerID of this.participatePlayerIDs) {
      await this.killPlayer(playerID, true);
    }

    await this.resetGame();
  }

  /**
   * reset the whole game
   */
  async resetGame() {
    this.gameStarted = false;
    this.fires = new Set();
    this.cooldown = new Set();
    this.fireCounter = 0;
    this.gameStarted = false;
    this.participatePlayerIDs = new Set();
    for (const mapName of this.arenaOfMaps.keys()) {
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update',
          mapName,
          CellSet.fromObject({
            name: LAYER_FIRE.layerName,
            cells: Array.from(this.fires),
          }),
      );
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update',
          mapName,
          CellSet.fromObject({
            name: LAYER_BULLET.layerName,
            cells: Array.from(
                this.bullets,
                ([_, v]) => v['mapCoord'],
            ),
          }),
      );
    }
    for (const ID of this.updateMapIntervalIDs) {
      clearInterval(ID);
    }
    this.updateMapIntervalIDs.length = 0;
  }

  // ----------------------------------
  // State function for NPC
  // ----------------------------------

  /**
   * Show a dialog overlay in client browser.
   * @param {*} srcExt
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @param {*} sfInfo
   * @return {String} - the next state
   */
  async s2s_sf_joinBattleroyale(srcExt, playerID, kwargs, sfInfo) {
    const {next} = kwargs;
    this.participatePlayerIDs.add(playerID);
    await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[battleroyale] Join game successfully');
    return next;
  }

  /**
   *
   * @param {*} srcExt
   * @param {String} playerID
   * @param {Object} kwargs
   * @param {*} sfInfo
   * @return {String} - the next state
   */
  async s2s_sf_quitBattleroyale(srcExt, playerID, kwargs, sfInfo) {
    const {next} = kwargs;
    if (this.participatePlayerIDs.has(playerID)) {
      this.participatePlayerIDs.delete(playerID);
    }
    return next;
  }

  /**
   * provide state function to npc
   * @param {*} srcExt
   * @param {*} registerFunc
   */
  async s2s_provideStateFunc(srcExt, registerFunc) {
    this.helper.callS2sAPI(srcExt, registerFunc, this.helper.getListOfStateFunctions(this));
  }
}

export default Standalone;
