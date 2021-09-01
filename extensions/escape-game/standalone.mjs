// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

import jwt from 'jsonwebtoken';

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
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }

  async c2s_getAccessToken(player) {
    return await jwt.sign({roomId: '123'}, 'secret', {expiresIn: 10});
  }
}

export default Standalone;
