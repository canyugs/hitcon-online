// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from '../../common/maplib/cellset.mjs';
import {LAYER_BOMB, BOMB_COOLDOWN, LAYER_BOMB_EXPLODE} from './common/client.mjs';
import {MapCoord} from '../../common/maplib/map.mjs';
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const alarm = require('alarm');
const config = require('config');

const BOMB_COUNTDOWN = 3000; // millisecond
const BOMB_EXPLODE_TIME = 500; // millisecond
const START_GAME_INTERVAL = 3600_000; // millisecond


const BOMB_EXPLODE_RANGE = [
  {dx: 0, dy: 0, w: 1, h: 1},
  {dx: 0, dy: 1, w: 1, h: 1},
  {dx: 0, dy: -1, w: 1, h: 1},
  {dx: 1, dy: 0, w: 1, h: 1},
  {dx: -1, dy: 0, w: 1, h: 1},
];

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
    this.arenaOfMaps = this.helper.gameMap.getOriginalCellSetStartWith('bombmanArena');
    
    // set dynamic cell set: bombmanHasBomb
    this.bombCells = new Map(); // key: a unique bomb ID; value: the cell
    this.bombID = 0;
    this.gameStarted = false;
    this.explodeCells = new Map();

    for (const mapName of this.arenaOfMaps.keys()) {
      await this.helper.broadcastCellSetUpdateToAllUser(
          'set', // operation type
          mapName,
          CellSet.fromObject({
            name: LAYER_BOMB.layerName,
            priority: 3,
            cells: Array.from(this.bombCells.values()),
            layers: {[LAYER_BOMB.layerName]: 'B'},
            dynamic: true,
          }),
      );
      await this.helper.broadcastCellSetUpdateToAllUser(
          'set', // operation type
          mapName,
          CellSet.fromObject({
            name: LAYER_BOMB_EXPLODE.layerName,
            priority: 3,
            cells: Array.from(this.explodeCells.values()),
            layers: {[LAYER_BOMB_EXPLODE.layerName]: 'BE'},
            dynamic: true,
          }),
      );
    }

    // detect bomb explsion
    this.helper.gameState.registerOnPlayerUpdate((msg) => {
      try {
        this.onPlayerUpdate(msg);
      } catch (e) {
        console.error('bombman register player update listener failed: ', e, e.stack);
      }
    });

    // set cooldown
    this.cooldown = new Set(); // TODO: Cooldown Manager

    this.participatePlayerIDs = new Set(); // store playerID
    this.playerOldPosition = new Map(); // [string, mapCoord] store player's position before tp to game

    const initTime = new Date();
    const startTime = new Date(Math.floor((+initTime + START_GAME_INTERVAL - 1) / START_GAME_INTERVAL) * START_GAME_INTERVAL);
    alarm(startTime, this.setGameInterval.bind(this));

    // get config from default
    if (config.has('bombman.arena')) {
      let {mapName, x, y} = config.get('bombman.arena');
      this.arenaCoord = new MapCoord(mapName, x, y);
    } else {
      // default position (if no config)
      this.arenaCoord = new MapCoord('world1', 1, 1);
    }
  }

  /**
   * Game internal
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
    if (this.participatePlayerIDs.size < 3) {
      for (const playerID of this.participatePlayerIDs) {
        await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[bombman] player not enough to start (less than 3)');
      }
      return false;
    }
    for (const playerID of this.participatePlayerIDs) {
      const playerloc = await this.helper.getPlayerLocation(playerID);
      this.playerOldPosition.set(playerID, playerloc);
      await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[bombman] Game Start!');
      await this.teleportPlayer(playerID);
    }
    this.gameStarted = true;
    return true;
  }

  /**
   * Given a Coordinate, return inside bombman arena or not
   * @param {MapCoord} cellCoord - The cell position.
   * @return {Boolean} inside or not
   */
  insideMap(cellCoord) {
    const cellsets = this.arenaOfMaps.get(cellCoord.mapName);
    return cellsets.some((cellset) => cellset.containsMapCoord(cellCoord));
  }

  /**
   * Given a bomb, return bombCoord
   * @param {MapCoord} cellCoord - The bomb position.
   * @return {Array} the explode range array
   */
  formExplodeCells(cellCoord) {
    const cells = [];

    for (const {dx, dy, w, h} of BOMB_EXPLODE_RANGE) {
      const bombcell = cellCoord.copy();
      bombcell.x += dx;
      bombcell.y += dy;
      const isWall = this.helper.gameMap.getCell(bombcell, 'wall');
      const inside = this.insideMap(bombcell);

      if (isWall === false && inside) {
        cells.push({
          x: bombcell.x,
          y: bombcell.y,
          w: w,
          h: h,
        });
      }
    }
    return cells;
  }

  /**
   * Client tries to place a bomb at mapCoord.
   * The server returns true on success.
   * @param {Object} player - (TODO: needs docs)
   * @param {Object} mapCoord - The bomb position.
   * @return {Boolean} success or not
   */
  async c2s_placeBomb(player, mapCoord) {
    if (!this.participatePlayerIDs.has(player.playerID)) return;
    mapCoord = MapCoord.fromObject(mapCoord);

    // mapCoord has to be inside an arena
    // TODO: use the utility function in maplib if there is such function
    const inside = this.insideMap(mapCoord);
    if (!inside || !this.gameStarted) return false;

    // TODO: check if the player can set a bomb or not
    if (this.cooldown.has(player.playerID)) return false;
    this.cooldown.add(player.playerID);
    setTimeout(() => {
      this.cooldown.delete(player.playerID);
    }, BOMB_COOLDOWN);
    const bombID = this.bombID++;
    this.bombCells.set(bombID, mapCoord);
    await this.helper.broadcastCellSetUpdateToAllUser(
        'update', // operation type
        mapCoord.mapName,
        CellSet.fromObject({
          name: LAYER_BOMB.layerName,
          cells: Array.from(this.bombCells.values()),
        }),
    );

    // setTimeout to remove bomb
    setTimeout(async (bombID) => {
      let explodeCell = this.bombCells.get(bombID);
      explodeCell = this.formExplodeCells(explodeCell);
      this.explodeCells.set(bombID, {explodeCell});
      this.bombCells.delete(bombID);
      // clean bomb
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update', // operation type
          mapCoord.mapName,
          CellSet.fromObject({
            name: LAYER_BOMB.layerName,
            cells: Array.from(this.bombCells.values()),
          }),
      );
      // add explosion
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update', // operation type
          mapCoord.mapName,
          CellSet.fromObject({
            name: LAYER_BOMB_EXPLODE.layerName,
            cells: Array.from(explodeCell.values()),
          }),
      );
      // detect explode people
      const players = this.helper.gameState.getPlayers();
      players.forEach(async (player, playerID) => {
        for (const cell of explodeCell) {
          if (player.mapCoord.x == cell.x && player.mapCoord.y == cell.y) {
            await this.killPlayer(playerID);
            break;
          }
        }
      });

      // clean explosion
      setTimeout(async (bombID) => {
        this.explodeCells.delete(bombID);
        await this.helper.broadcastCellSetUpdateToAllUser(
            'update',
            mapCoord.mapName,
            CellSet.fromObject({
              name: LAYER_BOMB_EXPLODE.layerName,
              cells: Array.from(this.explodeCells.values()),
            }),
        );
      }, BOMB_EXPLODE_TIME, bombID);
    }, BOMB_COUNTDOWN, bombID);

    return true;
  }

  /**
   * called when player update
   * detect touch explosion
   * @param {Object} msg // player move message
   * @return {undefined} // no return
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

    if (msg.removed) {
      // player disconnect, remove player if exists
      if (this.participatePlayerIDs.has(playerID)) {
        this.participatePlayerIDs.delete(playerID);
      }
      if (this.playerOldPosition.has(playerID)) {
        this.playerOldPosition.delete(playerID);
      }
      if (this.participatePlayerIDs.size <= 1) {
        await this.terminateGame();
      }
    }

    const explodeCell = this.helper.gameMap.getCell(mapCoord, LAYER_BOMB_EXPLODE.layerName);
    if (explodeCell) { // if walk into bomb => teleport to somewhere
      await this.killPlayer(playerID);
    }
    return;
  }

  /**
   * start the game
   * @param {*} srcExt
   * @param {String} playerID
   * @param {Object} kwargs
   * @param {*} sfInfo
   * @return {String} - the next state
   */
  async s2s_sf_joinBombman(srcExt, playerID, kwargs, sfInfo) {
    const {next} = kwargs;
    this.participatePlayerIDs.add(playerID);
    await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[bombman] Join game successfully!');
    return next;
  }

  /**
   * reset the game
   * @param {*} srcExt
   * @param {String} playerID
   * @param {Object} kwargs
   * @param {*} sfInfo
   * @return {String} - the next state
   */
  async s2s_sf_quitBombman(srcExt, playerID, kwargs, sfInfo) {
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

  /**
   * kill player and tp
   * @param {String} playerID player ID
   * @param {Boolean} endGame kill player and terminate ... ?
   */
  async killPlayer(playerID, endGame = false) {
    let target;
    if (this.playerOldPosition.has(playerID)) {
      target = this.playerOldPosition.get(playerID);
    } else { // default
      target = this.helper.gameMap.getRandomSpawnPoint();
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
    const target = this.arenaCoord.copy();
    await this.helper.teleport(playerID, target, true);
  }

  /**
   * game is over five trophy and quit
   */
  async terminateGame() {
    for (const playerID of this.participatePlayerIDs) {
      await this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 3000, '[bombman] You Win!');
      // TODO: give item
      // this.helper.callS2sAPI('item', 'giveItem', playerID, 'bombman_trophy', 1);
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
    this.bombCells = new Map();
    this.explodeCells = new Map();
    this.participatePlayerIDs = new Set();
    this.playerOldPosition = new Map();

    // clean bomb
    for (const mapName of this.arenaOfMaps.keys()) {
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update', // operation type
          mapName,
          CellSet.fromObject({
            name: LAYER_BOMB.layerName,
            cells: Array.from(this.bombCells.values()),
          }),
      );
      // clean explosion
      await this.helper.broadcastCellSetUpdateToAllUser(
          'update', // operation type
          mapName,
          CellSet.fromObject({
            name: LAYER_BOMB_EXPLODE.layerName,
            cells: Array.from(this.explodeCells.values()),
          }),
      );
    }
  }
}

export default Standalone;
