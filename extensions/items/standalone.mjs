// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';
import path from 'path';

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
    this.playerOnline = new Set();
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
    for (let itemTypeName of allItemsName) {
      const itemClasses = await import(`../items/common/itemClasses/${itemTypeName}/${itemTypeName}.mjs`);
      for (let itemClassName in itemClasses) {
        const itemClass = itemClasses[itemClassName];
        const item = new itemClass(this.helper);
        const itemName = itemClassName.toLowerCase();
        this.itemInfo[itemName] = {
          show: item.show,
          exchangeable: item.exchangeable,
          usable: item.usable,
        }
        this.itemInstances[itemName] = item;
      }
    }
  }

  /**
   * Client initialization. This function will set the basic information of a player's item to an empty object
   * The below function should be called whenever a player starts a game session.
   */
  async c2s_playerInit(player) {
    this.playerOnline.add(playerID);
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
   * Initialize the amount of a specific item to zero.
   * This function is called by a client to notify the server whenever he/she pick up a dropped item from the map.
   * Once the client calls , the server will consequently update its database.
   * itemName: string;
   * amount: number;
   */
  async c2s_setItem(playerID, itemName, amount) {
    /* player has not registered yet */
    if (!this.items.has(playerID)) {
      console.log('Player not initialized');
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
      return;
    }
    let itemObj = this.items.get(playerID);
    itemObj[itemName].amount = 0;
    this.items.set(playerID, itemObj);
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
      console.log('Player already initialized');
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
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
      console.log('Player already initialized');
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
      return;
    }
    const itemObj = this.items.get(playerID);
    if (!itemName in itemObj) {
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
      console.log('Player not initialized');
      return;
    }
    if (!itemName in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].exchangeable) {
      console.log("Item is not exchangeable");
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
      return;
    }
    if (!this.playerOnline.has(toPlayerID)) {
      console.log('Receiver not online');
      return;
    }

    const fromPlayerItem = this.items.get(playerID);
    if (!itemName in fromPlayerItem || fromPlayerItem[itemName].amount < amount) {
      console.log("Insufficient quantity");
      return;
    }
    fromPlayerItem[itemName].amount -= amount;
    this.items.set(playerID, fromPlayerItem);

    const toPlayerItem = this.items.get(toPlayerID);
    if (!itemName in toPlayerItem) {
      toPlayerItem[itemName] = { amount: 0 };
    }
    toPlayerItem[itemName] += amount;
    this.items.set(toPlayerID, toPlayerItem);

    /* Notify the client that a certain amount of items have been given */
    await this.helper.callS2cAPI('items', 'onReceiveItem', 5000, toPlayerID, playerID, itemName, amount);
  }

  /**
   * Use an item once.
   * @return {object} partials - An object with the following type:
   * itemName: string;
   * amount: number;
   */
  async c2s_useItem(playerID, itemName, amount) {
    if (!this.items.has(playerID)) {
      console.log('Player not initialized');
      return;
    }
    if (!itemName in this.itemInfo || !itemName in this.itemInstances) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].usable) {
      console.log("Item is not usable");
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
      return;
    }

    const item = this.items.get(playerID);
    if (!itemName in item || item[itemName].amount < amount) {
      console.log("Insufficient quantity");
      return;
    }
    item[itemName].amount -= amount;
    this.items.set(playerID, fromPlayerItem);

    itemInstances[itemName].useItem(amount);

    await this.helper.callS2cAPI('items', 'onUseItem', 5000, playerID, itemName, amount);
  }

  /**
   * This function should be called whenever a client is disconnected.
   * This way, the server can set the player's status to disconnected.
   * (a.k.a. remove playerID from the set `playerOnline`) 
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  async c2s_disconnect(playerID) {
    if (!this.items.has(playerID)) {
      console.log('Player not initialized');
      return;
    }
    if (!this.playerOnline.has(playerID)) {
      console.log('Player not online');
      return;
    }
    this.playerOnline.delete(playerID);
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
