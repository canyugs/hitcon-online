// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
   * This function should be called by the client whenever the game starts.
   */
  async gameStart() {
    this.itemInfo = await this.helper.callC2sAPI('items', 'getItemInfo', 5000);
    this.items = await this.helper.callC2sAPI('items', 'getAllItems', 5000);
  }

  /*
   * The below function is used to give an item to another player
   * This function should be called by the client whenever he/she wants to give an item to another player.
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
   * This function should be listened by the client extension manager.
   * Whenever the giver calls `giveItem`, the server should delete a specific number of items and inform the recipient of this fact.
   * Thus, this function is called whenever a client receives an item.
   *
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
   * The below function is used by the client to drop an unwanted item.
   * Dropped items will be displayed on the map.
  */
  async dropItem(itemName, amount) {
    /* Check if the player is closed to a dropped item */
    const result = await this.helper.callC2sAPI('items', 'dropItem', 5000, this.helper.gameClient.playerInfo.mapCoord, this.helper.gameClient.playerInfo.facing, itemName, amount);
  }

  /*
   * The below function is the callback function when a player picks up a dropped item from the floor.
   * This function is called whenever a player is closed to a dropped item.
   * It serves as a call back function whenever an item is used.
   */
  async pickupItem(itemName, amount) {
    /* Check if the player is closed to a dropped item */
    const result = await this.helper.callC2sAPI('items', 'pickupItem', 5000, itemName, amount);
  }

  /*
   * The below function is the callback function when an item is used.
   * This function should be listened by the client extension manager.
   * It serves as a call back function whenever an item is used.
   */
  async onUseItem(itemName, amount) {
    /* animation */
  }

  async disconnect() {
    const result = await this.helper.callC2sAPI('items', 'disconnect', 5000);
  }
};

export default Client;
