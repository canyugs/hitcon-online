// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * this.itemInfo contains the general information of an item.
   * this.items contains the information of items owned by the client.
   */
  constructor(helper) {
    this.helper = helper;
    this.itemInfo = {};
    this.items = {};
  }

  /*
   * On game start, the below function will retrieve all of the client's items from the server.
   */
  async gameStart() {
    this.itemInfo = await this.helper.callC2sAPI('items', 'getItemInfo', 5000);
    this.items = await this.helper.callC2sAPI('items', 'getAllItems', 5000);
  }

  /*
   * The below function is used to give an item to another player
   * itemName: string;
   * amount: number;
   * toPlayerID: string;
   */
  async giveItem(toPlayerID, itemName, amount) {
    if (!itemName in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    if (!this.itemInfo[itemName].exchangeable) {
      console.log("Item is not exchangeable");
      return;
    }
    if (!itemName in this.items || this.items[itemName].amount < amount) {
      console.log("Insufficient quantity");
      return;
    }
    this.items[itemName].amount -= amount;
    /* Notify the server that a certain amount of items have been given */
    const result = await this.helper.callC2sAPI('items', 'giveReceiveItem', 5000, toPlayerID, itemName, amount);
  }

  /*
   * The below function is used to receive an item from another player
   * itemName: string;
   * amount: number;
   * fromPlayerID: string;
   */
  async onReceiveItem(fromPlayerID, itemName, amount) {
    if (!name in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    if (!itemInfo[name].exchangeable) {
      console.log("Item is not exchangeable");
      return;
    }
    if (!itemName in this.items) {
      this.items[itemName] = { amount: 0 };
    }
    this.items[itemName] += amount;
  }

  /*
   * The below function is used to use an item.
   */
  async useItem(itemName, amount) {
    if (!itemName in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    const result = await this.helper.callC2sAPI('items', 'useItem', 5000, itemName, amount);
  }

  /*
   * The below function is the callback function when an item is used.
   */
  async onUseItem(itemName, amount) {
    /* animation */
  }
};

export default Client;
