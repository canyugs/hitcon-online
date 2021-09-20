// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

/**
 * This represents the in-gateway/in-area part of the extension.
 * One instance of InGateway will be created for each gateway service
 * launched.
 */
class InGateway {
  /**
   * Create the in-gateway extension object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    void helper;
  }

  /**
   * This is called by gateway service to initialize the in gateway part of
   * the extension.
   */
  async initialize() {
  }
}

export default InGateway;
