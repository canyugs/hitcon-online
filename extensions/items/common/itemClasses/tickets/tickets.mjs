// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Tickets {
  constructor(helper, imagePath) {
    this.helper = helper;
    this.imagePath = imagePath;
    this.show = false;
    this.exchangeable = true;
    this.usable = true;
  }

  async getImage() {
    return this.imagePath;
  }

  async useItem(amount) {
    console.log('Ticket used!');
  }
}

export default Tickets;
