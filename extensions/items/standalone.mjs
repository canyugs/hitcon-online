// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

import CellSet from '../../common/maplib/cellset.mjs';

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
    const allItemsName = await fs.promises.readdir(path.dirname(fileURLToPath(import.meta.url)) + '/common/itemClasses');
    const itemSettingJson = await fs.promises.readFile(`../extensions/items/common/config.json`);
    const itemConfig = JSON.parse(itemSettingJson).items;
    const itemBaseClasses = {};
    for (let itemTypeName of allItemsName) {
      const itemBaseModule = await import(`./common/itemClasses/${itemTypeName}/${itemTypeName}.mjs`);
      const itemBaseClass = itemBaseModule.default;
      itemBaseClasses[itemTypeName] = itemBaseClass;
    }
    let index = 0;
    for (let itemName in itemConfig) {
      const itemBaseClassName = itemConfig[itemName].baseClass;
      const item = new itemBaseClasses[itemBaseClassName](this.helper, itemConfig[itemName].imagePath);
      this.itemInfo[itemName] = {
        index: index,
        layer: itemConfig[itemName].layer,
        show: item.show,
        exchangeable: item.exchangeable,
        droppable: item.droppable,
        usable: item.usable
      };
      this.itemInstances[itemName] = item;
      index++;
    }

    /* Load all stored data */
    const storedData = this.helper.loadData();
    this.items = storedData.items ?? {};
    this.droppedItemInfo = storedData.droppedItemInfo ?? {};
    this.droppedItemCell = storedData.droppedItemCell ?? {};
    this.droppedItemIndex = storedData.droppedItemIndex ?? 0;

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
  }

  /**
   * This function packages all the data that need to be stored into a big object
   * This function is usually called before `this.helper.storeData`
   */
  PackStoredData() {
    return {
      items: this.items,
      droppedItemCell: this.droppedItemCell,
      droppedItemInfo: this.droppedItemInfo,
      droppedItemIndex: this.droppedItemIndex
    };
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
      this.helper.storeData(this.PackStoredData());
    })();
  }

    /**
   * Add an item to the given player's inventory.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to give.
   * @return Boolean success - Return true if the items are added.
   */
  _addItem(playerID, itemName, amount=1) {
    if (!Number.isInteger(amount)) {
      console.error('_addItem() passed amount not integer: ', amount);
      return false;
    }
    _ensurePlayerItem(playerID);
    this.items[playerID].amount += amount;
    this._deferFlush();
    return true;
  }

  /**
   * Take an item from the given player's inventory.
   * This function is for internal use only.
   * @param String playerID - ID of the player.
   * @param String itemName - The item name.
   * @param Number amount - The amount to take.
   * @return Boolean success - Return true if it was taken from the player's
   *   inventory, false if there's not enough.
   */
  _takeItem(playerID, itemName, amount=1) {
    if (!Number.isInteger(amount)) {
      console.error('_takeItem() passed amount not integer: ', amount);
      return false;
    }
    if (!(playerID in this.items)) return false;
    if (!(itemName in this.items[playerID])) return false;
    if (this.items[playerID][itemName].amount < amount) return false;

    this.items[playerID][itemName].amount -= amount;
    this._deferFlush();
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
    return this.items[playerID][itemName];
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
    this.ensurePlayer(player.playerID);
    const itemObj = this.items[player.playerID];
    return itemObj;
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

  /**
   * Use an item once.
   * @return {object} partials - An object with the following type:
   * itemName: string;
   * amount: number;
   */
  async c2s_useItem(player, itemName, amount) {
    this._ensurePlayer(player.playerID);
    if (!(itemName in this.itemInfo) || !(itemName in this.itemInstances)) {
      return {'error': "Item does not exist"};
      return;
    }
    if (!this.itemInfo[itemName].usable) {
      return {'error': 'Item is not usable'};
    }

    if (!this._takeItem(player.playerID, itemName, amount)) {
      return {'error': 'Insufficient quantity'};
    }

    this.itemInstances[itemName].useItem(amount);

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
    if (Number.isInteger(maxAmount) && maxMount > 0) {
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
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }
}

export default Standalone;
