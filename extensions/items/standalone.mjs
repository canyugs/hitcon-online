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
   *     properties: {};
   *   }
   * }
   */
  constructor(helper) {
    this.helper = helper;
    this.itemInfo = {};
    this.itemInstances = {};
    this.items = new Map();
    this.droppedItemCell = new Map();
    this.droppedItemInfo = new Map();
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
    for (const itemTypeName of allItemsName) {
      const itemBaseModule = await import(`../items/common/itemClasses/${itemTypeName}/${itemTypeName}.mjs`);
      const itemBaseClass = itemBaseModule.default;
      itemBaseClasses[itemTypeName] = itemBaseClass;
    }
    let index = 0;
    for (const itemName in itemConfig) {
      const itemBaseClassName = itemConfig[itemName].baseClass;
      const item = new itemBaseClasses[itemBaseClassName](this.helper, itemConfig[itemName].imagePath);
      this.itemInfo[itemName] = {
        index: index,
        layer: itemConfig[itemName].layer,
        show: item.show,
        exchangeable: item.exchangeable,
        usable: item.usable,
      };
      this.itemInstances[itemName] = item;
      index++;

      /* Initialize cell set for each items */
      for (const mapName of this.helper.gameMap.getOriginalCellSetStartWith('').keys()) { // Get all available maps.
        const cellSet = new CellSet(
            'droppedItem' + itemName.toUpperCase(),
            4,
            Array.from(this.droppedItemCell.values()),
            {'item': this.itemInfo[itemName].layer},
            true);
        this.helper.gameMap.setDynamicCellSet(mapName, cellSet);
      }
    }
  }

  /**
   * Client initialization. This function will set the basic information of a player's item to an empty object
   * The below function should be called whenever a player starts a game session.
   */
  async c2s_playerInit(player) {
    if (!this.items.has(playerID)) {
      this.items.set(playerID, {});
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
   *     properties: {};
   *   }
   * }
   */
  async c2s_getItemInfo(playerID) {
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
  async c2s_getAllItems(playerID) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }
    const itemObj = this.items.get(playerID);
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
  async c2s_getAllItems(playerID) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }
    const itemObj = this.items.get(playerID);
    return itemObj;
  }

  /**
   * Returning all items owned by the user
   * @return {object} partials - An object with the following type:
   * type Item: {
   *   amount: number;
   * }
   */
  async c2s_getItem(playerID, itemName) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }
    const itemObj = this.items.get(playerID);
    if (!(itemName in itemObj)) {
      console.log('No such item');
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
  async c2s_giveReceiveItem(playerID, toPlayerID, itemName, amount) {
    if (!this.items.has(playerID) || !this.items.has(toPlayerID)) {
      console.error('Player not initialized');
      return;
    }
    if (!(itemName in this.itemInfo)) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].exchangeable) {
      console.error('Item is not exchangeable');
      return;
    }

    const fromPlayerItem = this.items.get(playerID);
    if (!(itemName in fromPlayerItem) || fromPlayerItem[itemName].amount < amount) {
      console.log("Insufficient quantity");
      return;
    }
    fromPlayerItem[itemName].amount -= amount;
    this.items.set(playerID, fromPlayerItem);

    const toPlayerItem = this.items.get(toPlayerID);
    if (!itemName in toPlayerItem) {
      toPlayerItem[itemName] = {amount: 0};
    }
    toPlayerItem[itemName] += amount;
    this.items.set(toPlayerID, toPlayerItem);

    /* Notify the client that a certain amount of items have been given */
    try {
      await this.helper.callS2cAPI('items', 'onReceiveItem', 5000, toPlayerID, playerID, itemName, amount);
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
  async c2s_useItem(playerID, itemName, amount) {
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }
    if (!(itemName in this.itemInfo) || !(itemName in this.itemInstances)) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].usable) {
      console.error('Item is not usable');
      return;
    }

    const item = this.items.get(playerID);
    if (!(itemName in item) || item[itemName].amount < amount) {
      console.log("Insufficient quantity");
      return;
    }
    item[itemName].amount -= amount;
    this.items.set(playerID, fromPlayerItem);

    itemInstances[itemName].useItem(amount);

    try {
      await this.helper.callS2cAPI('items', 'onUseItem', 5000, playerID, itemName, amount);
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
  async c2s_dropItem(playerID, mapCoord, facing, itemName) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }

    /* update database */
    const itemObj = this.items.get(playerID);
    if (!itemName in itemObj) {
      console.error('No such item');
      return;
    }
    itemObj[itemName].amount -= 1;
    this.items.set(playerID, itemObj);

    /* update cell set */
    /* TODO: calculate dropped coordinate. Currently, the dropped coordinate is the same as the player's map coordinate */
    this.droppedItemCell.set(this.droppedItemIndex, {'x': mapCoord.x, 'y': mapCoord.y, 'w': 1, 'h': 1});
    this.droppedItemInfo.set(this.droppedItemIndex, itemName);
    this.droppedItemIndex++;
    for (const mapName of this.helper.gameMap.getOriginalCellSetStartWith('').keys()) { // Get all available maps.
      this.gameMap.updateDynamicCellSet(mapName, 'droppedItem' + itemName.toUpperCase(), Array.from(this.droppedItemCell.values()));
    }
  }

  /**
   * This function is called by a client to notify the server whenever he/she pick up a dropped item from the map.
   * Once the client calls , the server will consequently update its database.
   * itemName: string;
   * amount: number;
   */
  async c2s_pickupItem(playerID, mapCoord, droppedItemIndex) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.error('Player not initialized');
      return;
    }
    const cell = this.droppedItemCell.get(droppedItemIndex);
    if (Math.abs(mapCoord.x - cell.x) > 1 || Math.abs(mapCoord.y - cell.y) > 1) {
      console.error('Player too far away from dropped item');
      return;
    }
    /* update amount */
    const itemObj = this.items.get(playerID);
    const itemName = this.droppedItemInfo.get(droppedItemIndex);
    itemObj[itemName].amount += 1;
    this.items.set(playerID, itemObj);

    /* remove picked up item from cell */
    this.droppedItemCell.delete(droppedItemIndex);
    this.droppedItemInfo.delete(droppedItemIndex);

    /* update cell set */
    for (const mapName of this.helper.gameMap.getOriginalCellSetStartWith('').keys()) { // Get all available maps.
      this.gameMap.updateDynamicCellSet(mapName, 'droppedItem' + itemName.toUpperCase(), Array.from(this.droppedItemCell.values()));
    }
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
