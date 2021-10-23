// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import FSMExecutor from '../../../common/interactive-object/fsm-executor.mjs';

/**
 * ItemBase is the base class for the various item class.
 */
class ItemBase {
  /**
   * Create the item.
   */
  constructor(helper, imagePath, info, fsm) {
    this.helper = helper;
    this.imagePath = imagePath;
    this.info = info;
    this.fsm = fsm;

    const sfInfo = {
      name: `item-${this.info.name}`,
      visibleName: `Item ${this.info.visibleName}`
    };
    this.fsmExecutor = new FSMExecutor(this.helper, this.fsm, sfInfo);
  }

  /**
   * See FSMExecutor.registerExtStateFunc.
   */
  registerExtStateFunc(fnName, extName, methodName) {
    this.fsmExecutor.registerExtStateFunc(fnName, extName, methodName);
  }

  async getImage() {
    return this.imagePath;
  }

  async useItem(amount) {
    console.warn(`No action specified in item ${this.info.name}.`);
  }

  async useItemFSM(playerID, amount) {
    // NOTE: we ignore the amount.
    console.log(`[Item] Player '${playerID}' used item '${this.info.name}'`);
    await this.fsmExecutor.fsmWalk(playerID);
  }
}

export default ItemBase;
