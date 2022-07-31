// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import CellSet from '../../common/maplib/cellset.mjs';
import {LAYER_BOMB, BOMB_COOLDOWN, LAYER_BOMB_EXPLODE} from './common/client.mjs';
import {MapCoord} from '../../common/maplib/map.mjs';

const BOMB_COUNTDOWN = 3000; // millisecond
const BOMB_EXPLODE_TIME = 500; // millisecond

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
    this.obstaclesOfMaps = this.helper.gameMap.getOriginalCellSetStartWith('bombmanObstacles');

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
  }

  /**
   * Given a Coordinate, return inside bombman arena or not
   * @param {MapCoord} cellCoord - The cell position.
   * @return {Boolean} inside or not
   */
  insideMap(cellCoord) {
    for (const {cells} of this.arenaOfMaps.get(cellCoord.mapName)) {
      for (const cell of cells) {
        const width = cell.w ?? 1;
        const height = cell.h ?? 1;
        if (cell.x <= cellCoord.x && cellCoord.x < cell.x + width &&
            cell.y <= cellCoord.y && cellCoord.y < cell.y + height) {
          return true;
        }
      }
    }
    return false;
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
    mapCoord = MapCoord.fromObject(mapCoord);

    // mapCoord has to be inside an arena
    // TODO: use the utility function in maplib if there is such function
    const inside = this.insideMap(mapCoord);
    if (!inside || !this.gameStarted) return false;

    // TODO: check if the player can set a bomb or not
    if (this.cooldown.has(player.playerID)) return false;
    this.cooldown.add(player.playerID);
    setTimeout(()=>{
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
      players.forEach((player, playerID) => {
        for (const cell of explodeCell) {
          if (player.mapCoord.x == cell.x && player.mapCoord.y == cell.y) {
            const target = player.mapCoord.copy();
            target.x = 1;
            target.y = 1;
            this.helper.teleport(playerID, target, true);
            break;
          }
        }
      });

      // clean explosion
      setTimeout(async (bombID)=>{
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
   * @return {} // no return
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
    const explodeCell = this.helper.gameMap.getCell(mapCoord, LAYER_BOMB_EXPLODE.layerName);
    if (explodeCell) { // if walk into bomb => teleport to somewhere
      const target = mapCoord.copy();
      target.x = 1;
      target.y = 1;
      this.helper.teleport(msg.playerID, target, true);
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
  async s2s_sf_startBombman(srcExt, playerID, kwargs, sfInfo) {
    const {next} = kwargs;
    if (this.gameStarted) {
      console.log('[bombman] The game has already started');
      return next;
    }
    this.gameStarted = true;
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
  async s2s_sf_resetBombman(srcExt, playerID, kwargs, sfInfo) {
    const {next} = kwargs;
    if (!this.gameStarted) {
      console.log('[bombman] The game has not started yet');
      return next;
    }
    try {
      this.gameStarted = false;
      this.bombCells = new Map();
      this.explodeCells = new Map();

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
    } catch (e) {
      console.error(e);
      return FSM_ERROR;
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
