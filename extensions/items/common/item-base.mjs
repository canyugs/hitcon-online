// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * ItemBase is the base class for the various item class.
 */
class ItemBase {
  /**
   * Create the item.
   */
  constructor(helper, imagePath, info) {
    this.helper = helper;
    this.imagePath = imagePath;
    this.info = info;
  }

  async getImage() {
    return this.imagePath;
  }

  async useItem(amount) {
    console.warn(`No action specified in item ${this.info.name}.`);
  }
}

export default ItemBase;
