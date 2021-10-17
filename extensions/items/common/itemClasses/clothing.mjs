// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Clothing {
  /*
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper, imagePath) {
    this.helper = helper;
    this.imagePath = imagePath;
    this.show = true;
    this.exchangeable = false;
    this.usable = true;
    this.droppable = true;
  }

  async getImage() {
    return this.imagePath;
  }

  async useItem(amount) {
    console.log('Mask worn!');
  }
}

export default Clothing;
