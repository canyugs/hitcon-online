// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Tickets {
  constructor(helper) {
    this.show = false;
    this.exchangeable = false;
    this.usable = true;
    this.helper = helper;
  }
}

class ChatRoomTicket extends Tickets {
  /*
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper) {
    super(helper);
    this.helper = helper;
  }

  async getImage() {
    return './items/clothing/facemask.jpg'
  }

  async useItem(amount) {
    console.log('Ticket used');
  }
};

export { Tickets };
