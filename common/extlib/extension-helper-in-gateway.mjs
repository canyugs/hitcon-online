// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import ExtensionHelperBase from './extension-helper-base.mjs';

/**
 * One ExtensionHelper class is created for each instance of InGateway object
 * for each extension. This ExtensionHelper object provides the APIs for
 * extensions to do what they want to do.
 */
class ExtensionHelperInGateway extends ExtensionHelperBase {
  /**
   * Create the ExtensionHelper object.
   * This is usually called by the ExtensionManager.
   * @constructor
   * @param {ExtensionManager} extMan - The extension manager.
   * @param {Directory} dir - An RPC Directory instance.
   * @param {RPCHandler} rpcHandler - The RPC Handler for the gateway service.
   * @param {GatewayService) gateway - The gateway service object.
   * @param {AllAreaBroadcaster} broadcaster - A broadcaster for broadcasting
   * message.
   * @param {string} name - The name of the extension.
   */
  constructor(extMan, dir, rpcHandler, gateway, broadcaster, name) {
    super(extMan, dir, rpcHandler, broadcaster, name);
    this.gateway = gateway;
  }

  /**
   * The async part of the constructor.
   * @override
   */
  async asyncConstructor(ext) {
    this.ext = ext;
    await super.asyncConstructor(ext);
  }

  /**
   * Register an interaction. See the definition in base class.
   * @override
   */
  registerInteraction(x, y, callback) {
    void [x, y, callback];
    assert.fail('Not implemented');
  }
}

export default ExtensionHelperInGateway;
