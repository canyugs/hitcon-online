// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

const SF_PREFIX = 's2s_sf_';

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  /**
   * Register the state func with the extension given.
   */
  async _registerWith(ext) {
    const propList = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
    for (const p of propList) {
      if (typeof this[p] !== 'function') continue;
      if (!p.startsWith(SF_PREFIX)) continue;
      const fnName = p.substr(SF_PREFIX.length);
      this.helper.callS2sAPI(ext, 'registerStateFunc', fnName, this.helper.name, `sf_${fnName}`);
    }
  }

  /**
   * Register all state func available in this extension with the given
   * extension.
   */
  async s2s_reqRegister(srcExt, ext) {
    if (!ext) ext = srcExt;
    await this._registerWith(ext);
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }
}

export default Standalone;
