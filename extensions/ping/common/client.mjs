// Copyright 2022 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause


const PING_INTERVAL_MS = 1000;
const displayTextStyle = {
  position: 'absolute',
  top: '1px',
  left: '1px',
  zIndex: 50,
  padding: '0 2px',
  backgroundColor: '#888',
  color: '#000',
  fontSize: '0.8rem',
};


/**
 * TODO: jsdoc
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
  }

  /**
   * Initialize the layer and send the watermark data as a parameter from json file
   */
  async gameStart() {
    // TODO: can toggle display in settings
    const displayTextDOM = document.createElement('span');
    Object.assign(displayTextDOM.style, displayTextStyle);
    document.getElementById('maprender-overlay').appendChild((displayTextDOM));

    setInterval(async () => {
      const pingTime = Date.now();
      const result = await this.helper.callC2sAPI('ping', 'ping', PING_INTERVAL_MS);
      const latency = (typeof result === 'object' && result.error === 'timeout') ? '>1000ms' : `${Date.now() - pingTime}ms`;

      // display latency
      displayTextDOM.innerText = latency;
    }, PING_INTERVAL_MS);
  }
}


export default Client;
