// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ItemBase from '../item-base.mjs';

class Tickets extends ItemBase {
  constructor(helper, imagePath, info, fsm) {
    super(helper, imagePath, info, fsm);

    this.show = false;
    this.exchangeable = true;
    this.usable = true;
    this.droppable = true;
    this.consumable = true;
  }

  async useItem(playerID, amount) {
    console.log('Ticket used!');
  }
}

export default Tickets;
