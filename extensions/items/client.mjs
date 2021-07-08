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
    this.itemInfo = JSON.parse(fs.readFileSync('items.json'));
    this.items = {};
  }

  /*
   * On game start, the below function will retrieve all of the client's items from the server.
   */
  async gameStart() {
    /* TODO: Retrieve item information from the server */
    let retrievedItems = [];

    for (let item of retrievedItems) {
      this.items[item.name] = {
        amount: 0
      }
    }

    /* TODO register each item */
  }

  /*
   * The below function is used to give an item to another player
   * item: {
   *    name: string;
   *    amount: number;
   * }
   */
  async giveItem(item) {
    if (!name in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    if (!items[name].exchangeable) {
      console.log("Item is not exchangeable");
      return;
    }
    if (items[name].amount < item.amount) {
      console.log("Insufficient quantity");
      return;
    }
  }

  /*
   * The below function is used to receive an item from another player
   * item: {
   *    name: string;
   *    amount: number;
   * }
   */
  async onReceiveItem(item) {
    if (!name in this.itemInfo) {
      console.log("Item does not exist");
      return;
    }
    if (!items[name].exchangeable) {
      console.log("Item is not exchangeable");
      return;
    }
    if (!name in this.items) {
      this.items[item.name] = {
        amount: item.amount
      }
    }
    else {
      this.items[item.name].amount += item.amount;
    }
  }

  /*
   * The below function is used to use an item
   * item: {
   *    name: string;
   * }
   */
  async useItem(item) {
    
  }

  /*
   * The below function is the callback function when an item is used
   * item: {
   *    name: string;
   * }
   */
  async onItemUse(item) {

  }
};

export default Client;
