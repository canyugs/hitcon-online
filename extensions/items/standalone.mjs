// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';
import path from 'path';
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
  }

  /**
   * Initialize the standalone extension server.
   * The following describes what needs to be done for initialization
   * 1. Iterate through all items in `items` directory
   * 2. Retrieve `info.json` (which contains the basic information of an item).
   * 3. Create an item instance (which contains all possible functions that can be performed on the item)
   */
  async initialize() {
    const allItemsName = await fs.promises.readdir('../extensions/items/common/itemClasses');
    const itemSettingJson = await fs.promises.readFile(`../extensions/items/common/config.json`);
    const itemConfig = JSON.parse(itemSettingJson).items;
    const itemBaseClasses = {};
    for (let itemTypeName of allItemsName) {
      const itemBaseModule = await import(`../items/common/itemClasses/${itemTypeName}/${itemTypeName}.mjs`);
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
   * Returning all items owned by the user
   * @return {object} partials - An object with the following type:
   * type ItemObj = {
   *   [itemName: string]: {
   *     amount: number;
   *   }
   * }
   */
  async c2s_getAllItems(player) {
    /* player has not registered yet */
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
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
  async c2s_getAllItems(player) {
    /* player has not registered yet */
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
    const itemObj = this.items[player.playerID];
    return itemObj;
  }

  /**
   * Returning all items owned by the user
   * @return {object} partials - An object with the following type:
   * type Item: {
   *   amount: number;
   * }
   */
  async c2s_getItem(player, itemName) {
    /* player has not registered yet */
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
    const itemObj = this.items[player.playerID];
    if (!(itemName in itemObj)) {
      console.error('No such item');
      return;
    }
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
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
    if (!(toPlayerID in this.items)) {
      this.items[toPlayerID] = {};
    }
    if (!(itemName in this.itemInfo)) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].exchangeable) {
      console.error('Item is not exchangeable');
      return;
    }

    const fromPlayerItem = this.items[player.playerID];
    if (!(itemName in fromPlayerItem) || fromPlayerItem[itemName].amount < amount) {
      console.error('Insufficient quantity');
      return;
    }
    fromPlayerItem[itemName].amount -= amount;
    this.items[player.playerID] = fromPlayerItem;

    const toPlayerItem = this.items.get(toPlayerID);
    if (!(itemName in toPlayerItem)) {
      toPlayerItem[itemName] = {amount: 0};
    }
    toPlayerItem[itemName] += amount;
    this.items[toPlayerID] = toPlayerItem;

    /* Store data into file */
    this.helper.storeData(this.PackStoredData());

    /* Notify the client that a certain amount of items have been given */
    try {
      await this.helper.callS2cAPI('items', 'onReceiveItem', 5000, toPlayerID, player.playerID, itemName, amount);
    } catch (e) {
      // ignore if recipient is offline
    }
  }

  /**
   * Use an item once.
   * @return {object} partials - An object with the following type:
   * itemName: string;
   * amount: number;
   */
  async c2s_useItem(player, itemName, amount) {
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }
    if (!(itemName in this.itemInfo) || !(itemName in this.itemInstances)) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].usable) {
      console.error('Item is not usable');
      return;
    }

    const item = this.items[player.playerID];
    if (!(itemName in item) || item[itemName].amount < amount) {
      console.error('Insufficient quantity');
      return;
    }
    item[itemName].amount -= amount;
    this.items[player.playerID, fromPlayerItem];

    itemInstances[itemName].useItem(amount);

    /* Store data into file */
    this.helper.storeData(this.PackStoredData());

    try {
      await this.helper.callS2cAPI('items', 'onUseItem', 5000, player.playerID, itemName, amount);
    } catch (e) {
      // ignore if player becomes offline for some reason
    }
  }

  /**
   * This function is called by a client to notify the server whenever he/she drops an item on the ground.
   * Once the client calls, the server will consequently update its database.
   * itemName: string;
   * amount: number;
   */
  async c2s_dropItem(player, mapCoord, facing, itemName) {
    /* player has not registered yet */
    if (!(player.playerID in this.items)) {
      this.items[player.playerID] = {};
    }

    let itemObj = this.items[player.playerID];
    if (!(itemName in itemObj)) {
      console.error('No such item');
      return;
    }
    if (!this.itemInfo[itemName].droppable) {
      console.log("Item is not droppable");
      return;
    }
    itemObj[itemName].amount -= 1;
    this.items[player.playerID, itemObj];

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
    this.helper.storeData(this.PackStoredData());

    /* Update cell set */
    this.gameMap.updateDynamicCellSet(mapCoord.mapName,
        'droppedItem' + mapCoord.mapName,
        Array.from(Object.values(this.droppedItemCell)));
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
      console.error('Player too far away from dropped item');
      return;
    }
    /* update amount */
    let itemObj = this.items[player.playerID];
    const itemName = this.droppedItemInfo[droppedItemIndex];
    if (!this.itemInfo[itemName].droppable) {
      console.log("Item is not droppable");
      return;
    }
    itemObj[itemName].amount += 1;
    this.items[player.playerID, itemObj];

    /* remove picked up item from cell */
    delete this.droppedItemCell[droppedItemIndex];
    delete this.droppedItemInfo[droppedItemIndex];

    /* Store data into file */
    this.helper.storeData(this.PackStoredData());

    /* Update cell set */
    this.gameMap.updateDynamicCellSet(mapCoord.mapName,
        'droppedItem' + itemName.toUpperCase(),
        Array.from(Object.values(this.droppedItemCell)));
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
