// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class Facemask {
  /*
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   */
  constructor(helper) {
    this.helper = helper;
  }

  async useItem(amount) {
    console.log('Mask worn!');
  }

};

export default Facemask;
