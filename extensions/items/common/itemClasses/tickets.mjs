// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ItemBase from '../item-base.mjs';

class Tickets extends ItemBase {
  constructor(helper, imagePath, info) {
    super(helper, imagePath, info);

    this.show = false;
    this.exchangeable = true;
    this.usable = true;
    this.droppable = true;
  }

  async useItem(amount) {
    console.log('Ticket used!');
  }
}

export default Tickets;
