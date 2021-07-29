// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
    window.testCallServer1 = () => {
      this.testCallServer1();
    };
    window.testCallServer2 = () => {
      this.testCallServer2();
    };
  }

  async s2c_Hello(name) {
    console.log(`Received hello from ${name}`);
    return `Hello ${name}~~~`;
  }

  async testCallServer1() {
    const result = await this.helper.callC2sAPI('helloworld', 'trySayHello', 5000, 'client', 'server');
    console.log(`Server said ${JSON.stringify(result)} after we called trySayHello()`);
  }

  async testCallServer2() {
    const result = await this.helper.callC2sAPI(null, 'doMultiplyAccumulate', 5000, 3, 7, 2);
    console.log(`doMultiplyAccumulate(3, 7, 2) = ${result}`);
  }
}

export default Client;
