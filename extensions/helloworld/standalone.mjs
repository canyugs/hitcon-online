// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';

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

  async c2s_trySayHello(player, src, dst) {
    console.log(`Player ${player.playerID} asked to try say hello, from ${src} to ${dst}`);
    const res = await this.helper.callS2cAPI(player.playerID, 'helloworld', 'Hello', 4000, 'The Server');
    console.log(`Client said ${JSON.stringify(res)} after calling Hello`);
    return 'I tried!';
  }

  async c2s_doMultiplyAccumulate(player, a, b, c) {
    console.log(`${player.playerID} wanted to multiply accumulate ${a}, ${b} and ${c}`);
    return await this.helper.callS2sAPI('helloworld', 'multiplyAccumulate', a, b, c);
  }

  async s2s_multiplyAccumulate(serviceName, a, b, c) {
    console.log(`${serviceName} asked to multiply accumulate ${a}, ${b} and ${c}`);
    const ab = a+b;
    const result = await this.helper.callS2sAPI(serviceName, 'multiply', ab, c);
    return result;
  }

  async s2s_multiply(serviceName, a, b) {
    console.log(`${serviceName} asked to multiply ${a} and ${b}`);
    return a*b;
  }
}

export default Standalone;
