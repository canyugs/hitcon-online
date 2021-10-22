// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import ItemBase from '../item-base.mjs';

class Clothing extends ItemBase {
  /**
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper, imagePath, info) {
    super(helper, imagePath, info);

    this.show = true;
    this.exchangeable = false;
    this.usable = true;
    this.droppable = true;
  }

  async useItem(amount) {
    console.log('Mask worn!');
  }
}

export default Clothing;
