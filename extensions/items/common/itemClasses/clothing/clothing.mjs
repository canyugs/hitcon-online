// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Clothing {
  constructor(helper) {
    this.show = true;
    this.exchangeable = false;
    this.usable = true;
    this.helper = helper;
  }
}

class Facemask extends Clothing {
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
    console.log('Mask worn!');
  }
};

class Sunglasses extends Clothing {
  /*
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper) {
    super(helper);
    this.helper = helper;
  }

  async getImage() {
    return './items/clothing/sunglasses.jpg'
  }

  async useItem(amount) {
    console.log('Sunglasses worn!');
  }
};

export { Facemask, Sunglasses };
