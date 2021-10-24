// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

import CellSet from '../../common/maplib/cellset.mjs';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

// Bring out the FSM_ERROR for easier reference.
const FSM_ERROR = InteractiveObjectServerBaseClass.FSM_ERROR;

const SF_PREFIX = 's2s_sf_';

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   *
   * @param {Item} item - A map that maps player id to an object that represents all items owned by a player
   * type Item = {
   *   amount: number;
   * }
   *
   * @param {ItemInfo} itemInfo - An object that contains the basic information of all items
   * type ItemInfo = {
   *   [itemName: string]: {
   *     url: string;
   *     show: boolean;
   *     exchangeable: boolean;
   *     droppable: boolean;
   *     properties: {};
   *   }
   * }
   */
  constructor(helper) {
    this.helper = helper;
    this.itemInfo = {};
    this.itemInstances = {};
    this.items = {};
    this.droppedItemCell = {};
    this.droppedItemInfo = {};
    this.droppedItemIndex = 0;

    // Used by _deferFlush() to remove duplicate flushing attempts.
    this.flushInProgress = false;
  }

  /**
   * Initialize the standalone extension server.
   * The following describes what needs to be done for initialization
   * 1. Iterate through all items in `items` directory
   * 2. Retrieve `info.json` (which contains the basic information of an item).
   * 3. Create an item instance (which contains all possible functions that can be performed on the item)
   */
  async initialize() {
    // Load the item classes.
    const allItemsName = await fs.promises.readdir(path.dirname(fileURLToPath(import.meta.url)) + '/common/itemClasses');
    const itemBaseClasses = {};
    for (let itemTypeName of allItemsName) {
      if (!itemTypeName.endsWith('.mjs')) {
        continue;
      }
      itemTypeName = itemTypeName.substr(0, itemTypeName.length-('.mjs'.length));
      const itemBaseModule = await import(`./common/itemClasses/${itemTypeName}.mjs`);
      const itemBaseClass = itemBaseModule.default;
      itemBaseClasses[itemTypeName] = itemBaseClass;
    }
    // Load individual item configs.
    const itemSettingJson = await fs.promises.readFile(getRunPath('items', 'config.json'));
    const itemConfig = JSON.parse(itemSettingJson).items;
    let index = 0;
    for (let itemName in itemConfig) {
      // Gather available info.
      let desc = itemConfig[itemName].desc;
      desc = (typeof desc === 'string')?desc:'';
      let visibleName = itemConfig[itemName].visibleName;
      visibleName = (typeof desc === 'string')?visibleName:itemName;
      const itemInfoObj = {
        index: index,
        visibleName: visibleName,
        name: itemName,
        desc: desc,
        layer: itemConfig[itemName].layer,
      };

      // Load FSM if any.
      let fsmFilename = itemConfig[itemName].fsm;
      if (fsmFilename === true) {
        // true means that the default fsm path is used.
        fsmFilename = `${itemName}.json`;
      }
      let fsmObj = null;
      if (typeof fsmFilename === 'string') {
        const fsmJson = await fs.promises.readFile(getRunPath('items', 'fsm', fsmFilename));
        fsmObj = JSON.parse(fsmJson).FSM;
      }

      // Create the item class.
      const itemBaseClassName = itemConfig[itemName].baseClass;
      const item = new itemBaseClasses[itemBaseClassName](this.helper, itemConfig[itemName].imagePath, itemInfoObj, fsmObj);
      itemInfoObj.show = item.show;
      itemInfoObj.exchangeable = item.exchangeable;
      itemInfoObj.droppable = item.droppable;
      itemInfoObj.usable = item.usable;
      itemInfoObj.consumable = item.consumable;

      if (itemInfoObj.usable && (typeof fsmObj !== 'object' || fsmObj === null || typeof fsmObj.initialState !== 'string')) {
        console.warn(`Item ${itemName} is usable but no fsm specified.`, fsmObj);
      }

      // Description
      this.itemInfo[itemName] = itemInfoObj;
      this.itemInstances[itemName] = item;
      index++;
    }

    /* Load all stored data */
    await this._loadFromDisk();

    /* Changed to one cellset per world instead of one cellset per item per world */
    /* The type of item dropped is stored in `this.droppedItemInfo` */
    for (const mapName of this.helper.gameMap.getOriginalCellSetStartWith('').keys()) {
      const cellSet = new CellSet(
        'droppedItem' + mapName,
        4,
        Array.from(Object.values(this.droppedItemCell)),
        {"item": 0},
        true);
      this.helper.gameMap.setDynamicCellSet(mapName, cellSet);
    }

    // Register the chat commands.
    try {
      this.helper.callS2sAPI('chat', 'registerCmd', {
        cmd: 'ListItems', ext: this.helper.name, c2s: 'cmdListItems',
        helpMsg: '--- Show user\'s inventory'
      });
      this.helper.callS2sAPI('chat', 'registerCmd', {
        cmd: 'GiveItem', ext: this.helper.name, c2s: 'cmdGiveItem',
        helpMsg: '<player> <amount> <item> --- Give player an amount of items'
      });
      this.helper.callS2sAPI('chat', 'registerCmd', {
        cmd: 'TakeItem', ext: this.helper.name, c2s: 'cmdTakeItem',
        helpMsg: '<player> <amount> <item> --- Take an amount of items from player'
      });
      this.helper.callS2sAPI('chat', 'registerCmd', {
        cmd: 'UseItem', ext: this.helper.name, c2s: 'cmdUseItem',
        helpMsg: '<item> -- Use the item'
      });
    } catch (e) {
      console.warn(`Failure registering chat commands for items`);
      console.warn(e);
    }

    // Make sure we've the various state functions.
    await this.helper.callS2sAPI('iobj-lib', 'reqRegister');
    await this.helper.callS2sAPI('items', 'reqRegister');
  }

  /**
   * This function packages all the data that need to be stored into a big object
   * This function is usually called before `this.helper.storeData`
   */
  _packStoredData() {
    return {
      items: this.items,
      droppedItemCell: this.droppedItemCell,
      droppedItemInfo: this.droppedItemInfo,
      droppedItemIndex: this.droppedItemIndex
    };
  }

  /**
   * This function unpacks a JSON object that is created by _packStoredData() into this.
   */
  _unpackStoredData(data) {
    this.items = {};
    if (typeof data.items !== 'object') {
      console.warn('storedData.items is not an object', data.items);
    } else {
      for (const u in data.items) {
        this.items[u] = {};
        for (const i in data.items[u]) {
          if (!(i in this.itemInfo)) {
            console.error(`Player ${u} have item ${i} that doesn't exist`);
          } else {
            this.items[u][i] = data.items[u][i];
            if (!Number.isInteger(this.items[u][i].amount)) {
              this.items[u][i].amount = 0;
            }
          }
        }
      }
    }

    let droppedOK = true;
    try {
      if (!Number.isInteger(data.droppedItemIndex)) {
        console.warn('storedData.droppedItemIndex is not an integer: ', data.droppedItemIndex);
        droppedOK = false;
      }
      if (typeof data.droppedItemCell !== 'object' || typeof data.droppedItemInfo !== 'object') {
        console.warn('storedData.droppedItemCell or droppedItemInfo is not an object: ', data.droppedItemCell, data.droppedItemInfo);
        droppedOK = false;
      }
      if (Object.keys(data.droppedItemCell).length !== Object.keys(data.droppedItemInfo).length) {
        console.warn('storedData.droppedItemCell or droppedItemInfo have incorrect length: ', data.droppedItemIndex, data.droppedItemCell, data.droppedItemInfo);
        droppedOK = false;
      }
      for (const k in data.droppedItemCell) {
        if (!(k in data.droppedItemIndex)) {
          console.warn('mismatched key in data.droppedItem', k, data.droppedItemCell, data.droppedItemInfo);
          droppedOK = false;
          break;
        }
        if (!Number.isInteger(k)) {
          console.warn('storedData.droppedItem have non-integer keys', k, data.droppedItemCell, data.droppedItemInfo);
          droppedOK = false;
          break;
        }
      }
    } catch (e) {
      console.warn('storedData is bad: ', e);
    } finally {
      if (droppedOK) {
        this.droppedItemIndex = data.droppedItemIndex;
        this.droppedItemCell = data.droppedItemCell;
        this.droppedItemInfo = data.droppedItemInfo;
      }
    }
  }

  /**
   * This function will return an object that contains the basic information of all items.
   * @return {object} partials - An object with the following type:
   * type ItemInfo = {
   *   [itemName: string]: {
   *     url: string;
   *     show: boolean;
   *     exchangeable: boolean;
   *     usable: boolean;
   *     droppable: boolean;
   *     properties: {};
   *   }
   * }
   */
  async c2s_getItemInfo() {
    return this.itemInfo;
  }

  /**
   * This make sure that this.items[playerID] is available.
   * @param String playerID - ID of the player.
   */
  _ensurePlayer(playerID) {
    if (typeof playerID !== 'string') {
      console.error('PlayerID not string in _ensurePlayer', playerID);
      return;
    }
    if (!(playerID in this.items)) {
      /* player has not registered yet */
      this.items[playerID] = {};
    }
    this._deferFlush();
  }

  /**
   * This make sure that this.items[playerID][itemName] is available.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   */
  _ensurePlayerItem(playerID, itemName) {
    if (typeof itemName !== 'string') {
      console.error('itemName not string in _ensurePlayerItem', itemName);
      return;
    }
    this._ensurePlayer(playerID);
    if (!(itemName in this.items[playerID])) {
      this.items[playerID][itemName] = {amount: 0};
    }
    this._deferFlush();
  }

  /**
   * Flush the database to disk on next tick.
   */
  _deferFlush() {
    // Ignore the returning promise so it runs in the background.
    (async () => {
      if (this.flushInProgress === true) {
        // Already flushing in the next tick.
        return;
      }
      this.flushInProgress = true;
      await new Promise(resolve => setImmediate(resolve));
      this.flushInProgress = false;
      this.helper.storeData(this._packStoredData());
    })();
  }

  /**
   * Load the database on disk back to this class.
   */
  async _loadFromDisk() {
    const data = await this.helper.loadData();
    if (Object.keys(data).length === 0) {
      // First time loading, we don't need to do anything.
    } else {
      this._unpackStoredData(data);
    }
  }

  /**
   * Add an item to the given player's inventory.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to give.
   * @param Boolean hideNotification - True if we want to suppress the notification.
   * @return Boolean success - Return true if the items are added.
   */
  _addItem(playerID, itemName, amount=1, hideNotification=false) {
    if (!Number.isInteger(amount)) {
      console.error('_addItem() passed amount not integer: ', amount);
      return false;
    }
    if (typeof playerID !== 'string') {
      console.error('PlayerID not string in _addItem', playerID);
      return false;
    }
    if (typeof itemName !== 'string') {
      console.error('itemName not string in _addItem', itemName);
      return false;
    }
    if (!(itemName in this.itemInfo)) {
      console.error(`Invalid itemName '${itemName}'`);
      return false;
    }
    this._ensurePlayerItem(playerID, itemName);
    this.items[playerID][itemName].amount += amount;
    this._deferFlush();

    if (!hideNotification && amount > 0) {
      try {
        // No await because we don't need to wait for the client side.
        this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 5000, `You've received ${amount} x ${this.itemInfo[itemName].visibleName}`);
      } catch (e) {
        console.warn(`User ${playerID} may not be online, failed to notify _addItem()`, e.stack);
      }
    }

    return true;
  }

  /**
   * Take an item from the given player's inventory.
   * This function is for internal use only.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to take.
   * @param Boolean hideNotification - True if we want to suppress the notification.
   * @return Boolean success - Return true if it was taken from the player's
   *   inventory, false if there's not enough.
   */
  _takeItem(playerID, itemName, amount=1, hideNotification=false) {
    if (!Number.isInteger(amount)) {
      console.error('_takeItem() passed amount not integer: ', amount);
      return false;
    }
    if (typeof playerID !== 'string') {
      console.error('PlayerID not string in _takeItem', playerID);
      return false;
    }
    if (typeof itemName !== 'string') {
      console.error('itemName not string in _takeItem', itemName);
      return false;
    }
    if (!(itemName in this.itemInfo)) {
      console.error(`Invalid itemName '${itemName}'`);
      return false;
    }

    if (!(playerID in this.items)) return false;
    if (!(itemName in this.items[playerID])) return false;
    if (this.items[playerID][itemName].amount < amount) return false;

    this.items[playerID][itemName].amount -= amount;
    this._deferFlush();

    if (!hideNotification && amount > 0) {
      try {
        // No await because we don't need to wait for the client side.
        this.helper.callS2cAPI(playerID, 'notification', 'showNotification', 5000, `You've lost ${amount} x ${this.itemInfo[itemName].visibleName}`);
      } catch (e) {
        console.warn(`User ${playerID} may not be online, failed to notify _takeItem()`, e.stack);
      }
    }

    return true;
  }

  /**
   * Return the amount of items the player have for the specified item.
   * This function is for internal use only.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @return Number amount - The amount of items in possession.
   */
  _countItem(playerID, itemName) {
    if (!(playerID in this.items)) return 0;
    if (!(itemName in this.items[playerID])) return 0;
    return this.items[playerID][itemName].amount;
  }

  /**
   * Atomically exchange all items in src for items in dst.
   * If any item is insufficient in src, the transaction will abort.
   * Example:
   * _exchangeItems('xxx', {'hydrogen': 2, 'oxygen': 1}, {'water': 1})
   */
  _exchangeItems(playerID, src, dst) {
    // NOTE: This function MUST NOT be async so it's atomic.
    if (typeof src !== 'object' || typeof dst !== 'object') {
      console.error(`src/dst not object in _exchangeItems`, src, dst);
      return false;
    }
    const checkEle = (k, v) => {
      if (!Number.isInteger(v) || v <= 0) {
        console.error(`src/dst value not positive integer in _exchangeItems`, v, src, dst);
        return false;
      }
      if (typeof k !== 'string' || !(k in this.itemInfo)) {
        console.error(`src/dst key not a vaild item name`, k, src, dst);
        return false;
      }
      return true;
    };
    for (const k in src) {
      if (!checkEle(k, src[k])) return false;
    }
    for (const k in dst) {
      if (!checkEle(k, dst[k])) return false;
    }
    for (const k in src) {
      if (this._countItem(playerID, k) < src[k]) {
        // Not enough items.
        return false;
      }
    }
    for (const k in src) {
      const ret = this._takeItem(playerID, k, src[k]);
      if (!ret) {
        console.error(`Weird race condition in items._exchangeItems`);
      }
    }
    for (const k in dst) {
      const ret = this._addItem(playerID, k, dst[k]);
      if (!ret) {
        console.error(`Impossible failure of items._addItem in items._exchangeItems`);
      }
    }
    return true;
  }

  /**
   * Returning all items owned by the user
   * @return {object} partials - An object with the following type:
   * type ItemObj = {
   *   [itemName: string]: {
   *     amount: number;
   *   }
   * }
   */
  async c2s_getAllItems(player) {
    this._ensurePlayer(player.playerID);
    const itemObj = this.items[player.playerID];
    return itemObj;
  }

  /**
   * Returning all currently dropped Items
   * @return {object} partials - An object with the following type:
   * type ItemObj = {
   *   [itemName: string]: {
   *     amount: number;
   *   }
   * }
   */
  async c2s_getAllDroppedItems(player) {
    // TODO
    console.warn('Unimplemented c2s_getAllDroppedItems called');
    return {};
  }

  /**
   * Returning info on an item owned by the user
   * @return {object} partials - An object with the following type:
   * type Item: {
   *   amount: number;
   * }
   */
  async c2s_getItem(player, itemName) {
    this._ensurePlayerItem(player.playerID, itemName);
    const itemObj = this.items[player.playerID];
    return itemObj[itemName];
  }

  /**
   * Give an item to another player.
   * @return {object} partials - An object with the following type:
   * toPlayerID: string;
   * itemName: string;
   * amount: number;
   */
  async c2s_giveReceiveItem(player, toPlayerID, itemName, amount) {
    this._ensurePlayer(player.playerID);
    this._ensurePlayer(toPlayerID);

    if (!(itemName in this.itemInfo)) {
      return {'error': "Item does not exist"};
    }
    if (!this.itemInfo[itemName].exchangeable) {
      return {'error': 'Item is not exchangeable'};
    }

    if (!this._takeItem(player.playerID, itemName, amount)) {
      return {'error': 'Insufficient quantity'};
    }

    if (!this._addItem(toPlayerID, itemName, amount)) {
      console.error(`_addItem(${toPlayerID}, ${itemName}, ${amount}) failed, this should not happen.`);
    }

    /* Notify the client that a certain amount of items have been given */
    try {
      await this.helper.callS2cAPI('items', 'onReceiveItem', 5000, toPlayerID, player.playerID, itemName, amount);
    } catch (e) {
      // ignore if recipient is offline
    }

    return {'ok': true};
  }

  async _useItem(playerID, itemName, amount) {
    this._ensurePlayer(playerID);
    if (!(itemName in this.itemInfo) || !(itemName in this.itemInstances)) {
      console.warn(`Using non-existent item by player ${playerID}`, itemName);
      return {'error': "Item does not exist"};
    }
    if (!this.itemInfo[itemName].usable) {
      console.warn(`Using item ${itemName} that is not usable by player ${playerID}`);
      return {'error': 'Item is not usable'};
    }

    if (this.itemInfo[itemName].consumable) {
      if (!this._takeItem(playerID, itemName, amount)) {
        return {'error': 'Insufficient quantity'};
      }
    }

    this.itemInstances[itemName].useItem(playerID, amount);

    /* Store data into file */
    this._deferFlush();

    try {
      await this.helper.callS2cAPI('items', 'onUseItem', 5000, player.playerID, itemName, amount);
    } catch (e) {
      // ignore if player becomes offline for some reason
    }

    return {'ok': true};
  }

  /**
   * Use an item once.
   * @return {object} partials - An object with the following type:
   * itemName: string;
   * amount: number;
   */
  async c2s_useItem(player, itemName, amount) {
    return await this._useItem(player.playerID, itemName, amount);
  }

  /**
   * This function is called by a client to notify the server whenever he/she drops an item on the ground.
   * Once the client calls, the server will consequently update its database.
   * itemName: string;
   * amount: number;
   */
  async c2s_dropItem(player, mapCoord, facing, itemName) {
    this._ensurePlayer(player.playerID);

    let itemObj = this.items[player.playerID];
    if (!(itemName in itemObj)) {
      return {'error': 'No such item'};
    }
    if (!this.itemInfo[itemName].droppable) {
      return {'error': "Item is not droppable"};
    }
    if (!this._takeItem(player.playerID, itemName, 1)) {
      return {'error': 'Insufficient amount'};
    }

    /* update cell set */
    const mapSize = this.gameMap.getMapSize(mapCoord.mapName);
    let droppedItemCoord = {};
    switch (facing) {
      case 'U':
        if (mapCoord.y === 0) {
          droppedItemCoord.y = mapCoord.y + 1; // dropped back instead of front
        } else {
          droppedItemCoord.y = mapCoord.y - 1;
        }
        droppedItemCoord.x = mapCoord.x;
        break;
      case 'D':
        if (mapCoord.y === mapSize.y - 1) {
          droppedItemCoord.y = mapCoord.y - 1; // dropped back instead of front
        } else {
          droppedItemCoord.y = mapCoord.y + 1;
        }
        droppedItemCoord.x = mapCoord.x;
        break;
      case 'L':
        if (mapCoord.x === 0) {
          droppedItemCoord.x = mapCoord.x + 1; // dropped right instead of left
        } else {
          droppedItemCoord.x = mapCoord.x - 1;
        }
        droppedItemCoord.y = mapCoord.y;
        break;
      case 'R':
        if (mapCoord.x === mapSize - 1) {
          droppedItemCoord.x = mapCoord.x - 1; // dropped left instead of right
        } else {
          droppedItemCoord.x = mapCoord.x + 1;
        }
        droppedItemCoord.y = mapCoord.y;
        break;
    }
    this.droppedItemCell[this.droppedItemIndex] = {"x": droppedItemCoord.x, "y": droppedItemCoord.y, "w": 1, "h": 1};
    this.droppedItemInfo[this.droppedItemIndex] = itemName;
    this.droppedItemIndex++;

    /* Store data into file */
    this._deferFlush();

    /* Update cell set */
    this.gameMap.updateDynamicCellSet(mapCoord.mapName,
        'droppedItem' + mapCoord.mapName,
        Array.from(Object.values(this.droppedItemCell)));

    return {'ok': true};
  }

  /**
   * This function is called by a client to notify the server whenever he/she pick up a dropped item from the map.
   * Once the client calls , the server will consequently update its database.
   * itemName: string;
   * amount: number;
   */
  async c2s_pickupItem(player, mapCoord, droppedItemIndex) {
    /* player has not registered yet */
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
    const cell = this.droppedItemCell[droppedItemIndex];
    if (Math.abs(mapCoord.x - cell.x) > 1 || Math.abs(mapCoord.y - cell.y) > 1) {
      return {'error': 'Player too far away from dropped item'};
    }
    /* update amount */
    const itemName = this.droppedItemInfo[droppedItemIndex];
    if (!this.itemInfo[itemName].droppable) {
      return {'error': "Item is not droppable"};
    }

    if (!this._addItem(player.playerID, itemName, 1)) {
      console.error(`_addItem(${player.playerID}, ${itemName}, 1) failed, this should not happen.`);
    }

    /* remove picked up item from cell */
    delete this.droppedItemCell[droppedItemIndex];
    delete this.droppedItemInfo[droppedItemIndex];

    /* Store data into file */
    this._deferFlush();

    /* Update cell set */
    this.gameMap.updateDynamicCellSet(mapCoord.mapName,
        'droppedItem' + itemName.toUpperCase(),
        Array.from(Object.values(this.droppedItemCell)));

    return {'ok': true};
  }

  /**
   * Give the playerID amount of item.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to give.
   * @param Number maxAmount - Give the player only up to maxAmount.
   * @return Object result - result.ok will be true if successful.
   */
  async s2s_AddItem(srcExtName, playerID, item, amount = 1, maxAmount = -1) {
    if (Number.isInteger(maxAmount) && maxAmount > 0) {
      const curAmount = this._countItem(playerID, item);
      if (curAmount+amount >= maxAmount) {
        // Max exceeded, limit the amount given.
        amount = maxAmount - curAmount;
      }
    }
    const result = {};
    result.ok = true;
    if (amount >= 1) result.ok = this._addItem(playerID, item, amount);
    return result;
  }

  /**
   * Take amount of item from playerID.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to give.
   * @return Object result - result.ok will be true if successful.
   * result.amount will be the amount taken.
   *
   * Note: If the amount is insufficient, we'll not take any items.
   */
  async s2s_TakeItem(srcExtName, playerID, item, amount = 1) {
    const result = {};
    result.ok = this._takeItem(playerID, item, amount);
    result.amount = amount;
    return result;
  }

  /**
   * Return the number of given item owned by the player.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @return Object result - result.amount is the amount in possession.
   */
  async s2s_CountItem(srcExtName, playerID, item) {
    const result = {};
    result.amount = this._countItem(playerID, item);
    result.ok = true;
    return result;
  }

  /**
   * Return the item infos for all items.
   */
  async s2s_GetItemInfos(srcExtName) {
    return this.itemInfo;
  }

  /**
   * Command for listing all items.
   */
  async c2s_cmdListItems(player, cmd) {
    let reply = '';
    const itemObj = this.items[player.playerID];
    let total = 0;
    let count = 0;
    for (const i in itemObj) {
      const item = itemObj[i];
      const info = this.itemInfo[i];
      if (item.amount === 0) continue;
      reply += `${item.amount}x ${info.visibleName}\n`;
      total += item.amount;
      count += 1;
    }

    reply += `Total: ${count} types of items, ${total} items\n`;
    return {status: 'ok', reply: reply};
  }

  /**
   * Command for giving item to player.
   * Syntax:
   * !/GiveItem <playerID> <amount> <item>
   */
  async c2s_cmdGiveItem(player, cmd) {
    if (!await this.helper.checkPerm(player.playerID, 'mod')) {
      return {status: 'noperm'};
    }

    const arr = cmd.split(' ');
    if (arr.length != 4) {
      return {status: 'error', reply: 'Invalid arguments'};
    }
    const receiver = arr[1];
    const amount = parseInt(arr[2], 10);
    const itemName = arr[3];
    if (isNaN(amount) || !Number.isInteger(amount)) {
      return {status: 'error', reply: 'Invalid amount'};
    }

    const success = this._addItem(receiver, itemName, amount);
    if (success) {
      return {status: 'ok', reply: 'Done'};
    }
    return {status: 'error', reply: 'Transfer failed'};
  }

  /**
   * Command for taking item from player.
   * Syntax:
   * !/TakeItem <playerID> <amount> <item>
   */
  async c2s_cmdTakeItem(player, cmd) {
    if (!await this.helper.checkPerm(player.playerID, 'mod')) {
      return {status: 'noperm'};
    }

    const arr = cmd.split(' ');
    if (arr.length < 4) {
      return {status: 'error', reply: 'Invalid arguments'};
    }
    const sender = arr[1];
    const amount = parseInt(arr[2], 10);
    const itemName = arr[3];
    if (isNaN(amount) || !Number.isInteger(amount)) {
      return {status: 'error', reply: 'Invalid amount'};
    }

    const success = this._takeItem(sender, itemName, amount);
    if (success) {
      return {status: 'ok', reply: 'Done'};
    }
    return {status: 'error', reply: 'Transfer failed'};
  }

  /**
   * Command for using the item.
   */
  async c2s_cmdUseItem(player, cmd) {
    const arr = cmd.split(' ');
    if (arr.length < 2) {
      return {status: 'error', reply: 'Invalid arguments'};
    }
    const itemName = arr[1];
    // No await to prevent client from timeout.
    const result = this._useItem(player.playerID, itemName, 1);
    if (typeof result === 'object' && result.ok === true) {
      return {status: 'ok', reply: 'Using item...'};
    }
    const ret = {status: 'error'};
    if (typeof result.error === 'string') {
      ret.reply = result.error;
    }
    return ret;
  }

  // ============= Interactive Object related =============

  /**
   * Register the state func with the extension given.
   */
  async _registerWith(ext) {
    const propList = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
    for (const p of propList) {
      if (typeof this[p] !== 'function') continue;
      if (!p.startsWith(SF_PREFIX)) continue;
      const fnName = p.substr(SF_PREFIX.length);
      this.helper.callS2sAPI(ext, 'registerStateFunc', fnName, this.helper.name, `sf_${fnName}`);
    }
  }

  /**
   * Register all state func available in this extension with the given
   * extension.
   */
  async s2s_reqRegister(srcExt, ext) {
    if (!ext) ext = srcExt;
    await this._registerWith(ext);
  }

  /**
   * Give the player an amount of items.
   * @param {String} playerID
   * @param {Object} kwargs - kwargs.amount specifies the amount of items to give.
   *   kwargs.maxAmount specifies the maximum amount of this item the user should have. The user will be given up to kwargs.amount items until the user have kwargs.maxAmount.
   *   kwargs.itemName - The item to give.
   *   kwargs.next - The next state.
   * @return {String} nextState - The next state.
   */
  async s2s_sf_giveItem(srcExt, playerID, kwargs, sfInfo) {
    let amount = kwargs.amount;
    let maxAmount = kwargs.maxAmount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;
    if (!Number.isInteger(maxAmount) || maxAmount <= 0) maxAmount = -1;

    const result = await this.helper.callS2sAPI('items', 'AddItem', playerID, itemName, amount, maxAmount);
    if (result.ok !== true) {
      console.error('items.AddItem() failed, maybe items ext is not running?');
      return FSM_ERROR;
    }
    return kwargs.nextState;
  }

  /**
   * Take amount of items from the player.
   * @param {String} playerID
   * @param {Object} kwargs - kwargs.amount specifies the amount the player should have and the amount to be taken.
   *   kwargs.item specifies which item to check.
   *   kwargs.haveItem specifies the state to go to if the player have the amount of specified items.
   *   kwargs.noItem specifies the state to go to if the player don't have the amount of specified items.
   * @return {String} nextState - The next state.
   */
  async s2s_sf_takeItem(srcExt, playerID, kwargs, sfInfo) {
    let amount = kwargs.amount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;

    const result = await this.helper.callS2sAPI('items', 'TakeItem', playerID, itemName, amount);
    if (typeof result.error !== 'undefined' || typeof result.ok !== 'boolean') {
      // Extension not running?
      console.error('items.TakeItem() failed, maybe items ext is not running?');
      return FSM_ERROR;
    }

    if (result.ok) {
      return kwargs.haveItem;
    } else {
      return kwargs.noItem;
    }
  }

  /**
   * Count the amount of given item owned by the player.
   * @param {Object} kwargs - kwargs.amount specifies the amount the player should have.
   *   kwargs.item specifies which item to check.
   *   kwargs.haveItem specifies the state to go to if the player have the amount of specified items.
   *   kwargs.noItem specifies the state to go to if the player don't have the amount of specified items.
   * @return {String} nextState - The next state.
   * WARNING: Using this method and takeItem() together may result in time-of-check-to-time-of-use exploit. In that case, please use takeItem() only.
   */
  async s2s_sf_haveItem(srcExt, playerID, kwargs, sfInfo) {
    let amount = kwargs.amount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;

    const result = await this.helper.callS2sAPI('items', 'CountItem', playerID, itemName);
    if (typeof result.error !== 'undefined' || !Number.isInteger(result.amount)) {
      // Extension not running?
      console.error('items.CountItem() failed, maybe items ext is not running?');
      return FSM_ERROR;
    }

    if (result.amount >= amount) {
      return kwargs.haveItem;
    } else {
      return kwargs.noItem;
    }
  }

  /**
   * See _exchangeItems()
   */
  async s2s_sf_exchangeItems(srcExt, playerID, kwargs, sfInfo) {
    const {src, dst, nextState, failState} = kwargs;

    const result = this._exchangeItems(playerID, src, dst);
    if (result) {
      return nextState;
    }
    return failState;
  }

  /**
   * Allow other ext to add state func.
   */
  async s2s_registerStateFunc(srcExt, fnName, extName, methodName) {
    for (const itemName in this.itemInstances) {
      const v = this.itemInstances[itemName];
      v.registerExtStateFunc(fnName, extName, methodName);
    }
  }
}

export default Standalone;
