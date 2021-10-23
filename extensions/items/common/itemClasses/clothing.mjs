// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ItemBase from '../item-base.mjs';

class Clothing extends ItemBase {
  /**
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper, imagePath, info, fsm) {
    super(helper, imagePath, info, fsm);

    this.show = true;
    this.exchangeable = false;
    this.usable = false;
    this.droppable = true;
    this.consumable = false;
  }

  async useItem(playerID, amount) {
    await this.useItemFSM(playerID, amount);
    console.log('Mask worn!');
  }
}

export default Clothing;
