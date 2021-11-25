// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import VarUtils from '../../common/interactive-object/var-utils.mjs';

/**
 * This is the base class for ExtensionHelper.
 * It supports common functionalities shared between the InGateway and
 * Standalone extension helper.
 */
class ExtensionHelperBase {
  /**
   * Create the ExtensionHelper object.
   * Constructor in the derived class is usually called by the
   * ExtensionManager.
   * @constructor
   * @param {ExtensionManager} extMan - The extension manager.
   * @param {Directory} dir - An RPC Directory instance.
   * @param {Handler} rpcHandler - An RPC Handler instance.
   * @param {AllAreaBroadcaster} broadcaster - A broadcaster for broadcasting
   * message.
   * @param {string} name - The name of the extension.
   * @param {GameMap} gameMap
   * @param {GameState} gameState
   */
  constructor(extMan, dir, rpcHandler, broadcaster, name, gameMap, gameState) {
    this.extMan = extMan;
    this.dir = dir;
    this.rpcHandler = rpcHandler;
    this.name = name;
    this.broadcaster = broadcaster;
    this.gameMap = gameMap;
    this.gameState = gameState;
    this.varUtils = new VarUtils(this);
  }

  /**
   * The async part of the constructor.
   * @param {Extension} ext - The actual extension object.
   */
  async asyncConstructor(ext) {
    this.ext = ext;
  }

  /**
   * Register an interaction. That is, if the player clicks on the map location
   * (x, y), then callback will be called.
   * @param {Number} x - The map x coordinate.
   * @param {Number} y - The map y coordinate.
   * @param {function} callback - The callback when player interact with the
   * specified tile in the map. Its prototype is:
   * async function (player)
   * Where player is an Player object, who clicked/interacted with the map tile.
   */
  registerInteraction(x, y, callback) {
    void [x, y, callback];
    assert.fail('Not supported, registerInteraction is only supported ' +
        'in derived class.');
  }

  /**
   * Register a callback on PlayerUpdate.
   * @param {Function} callback - The callback when any player updates.
   */
  registerOnPlayerUpdate(callback) {
    this.broadcaster.registerOnPlayerUpdate(callback);
  }

  /**
   * Register an onCellSetBroadcast. If any cellset is added/modified/removed,
   * the callback will be called.
   * @param {function} callback - The callback when cellset is changed, take a
   * cell set object, see .
   */
  registerOnCellSetBroadcast(callback) {
    this.broadcaster.registerOnCellSetBroadcast(callback);
  }

  /**
   * Return the list of all player IDs.
   * @return {object} An array of String, the player IDs.
   */
  listPlayerID() {
    assert.fail('Not implemented');
    return [];
  }

  /**
   * Return the Player object for the corresponding user ID.
   * @param {String} playerID - The player's ID.
   * @return {Player} player - The Player object for interacting with the user.
   */
  getPlayer(playerID) {
    void playerID;
    assert.fail('Not implemented');
    return undefined;
  }

  /**
   * Register an API for users to call. This can be called by code from the
   * browser side.
   * @param {String} methodName - The name of the method.
   * @param {function} callback - The callback to execute. Its signature is:
   * async function (player, args)
   * Whereby player is the Player object and args is an object.
   * It returns another object that is the result.
   */
  registerC2sAPI(methodName, callback) {
    void [methodName, callback];
    assert.fail('Not implemented');
  }

  /**
   * Call an API on the browser side.
   * @param {String} playerID - The ID of the player to call.
   * @param {String} extensionName - Name of the extension.
   * @param {String} methodName - Name of the method.
   * @param {Number} timeout - An optional timeout in ms.
   * @param {object} args - The arguments.
   * @return {object} result - The result from the call.
   */
  async callS2cAPI(playerID, extensionName, methodName, timeout, ...args) {
    const playerService = await this.dir.getPlayerGatewayService(playerID);
    const result = await this.rpcHandler.callRPC(playerService, 'callS2c',
        playerID, extensionName, methodName, timeout, args);
    return result;
  }

  /**
   * @param {String} playerID - The ID of the player to call.
   * @param {MapCoord} mapCoord - including map, x, y.
   * @param {Boolean} allowOverlap - Whether to allow overlap at destination.
   * @return {object} result - The result from the call.
   */
  async teleport(playerID, mapCoord, allowOverlap=false) {
    const playerService = await this.dir.getPlayerGatewayService(playerID);
    const result = await this.rpcHandler.callRPC(playerService, 'teleport',
        playerID, mapCoord, 'D', allowOverlap);
    return result;
  }

  /**
   * Get JWT token according to playerID from gateway service
   * @param {String} playerID - The ID of the player to call.
   * @return {object} result - decoded JWT token
   */
  async getToken(playerID) {
    const playerService = await this.dir.getPlayerGatewayService(playerID);
    const result = await this.rpcHandler.callRPC(playerService, 'getToken',
        playerID);
    return result;
  }

  /**
   * Call the API of another extension.
   * @param {String} extName - The name of the extension. Leave empty
   * for current extension.
   * @param {String} methodName - The name of the method.
   * @param {object} args - The arguments to the API.
   * @return {object} result - The result from the call.
   */
  async callS2sAPI(extName, methodName, ...args) {
    if (extName === null || extName === undefined || extName === '') {
      extName = this.name;
    }
    if (typeof extName != 'string') {
      console.error(`extName for callS2sAPI() should be a string`);
      return {'error': 'Invalid extName'};
    }
    const extService = await this.dir.getExtensionServiceName(extName);
    if (typeof extService != 'string') {
      console.error(`Service '${extName}' unavailable, got '${extService}'`);
      return {'error': 'Service unavailable'};
    }
    const result = await this.rpcHandler.callRPC(extService, 'callS2s',
        this.name, methodName, args);
    return result;
  }

  /**
   * Return true if the given extension is running.
   * 
   * @param {String} extName - The name of the extension.
   */
  async isExtRunning(extName) {
    const extService = await this.dir.getExtensionServiceName(extName);
    return (typeof extService === 'string');
  }

  /**
   * Broadcast a message to all clients.
   * @param {object} msg - The message.
   */
  async broadcastToAllUser(msg) {
    msg.extName = this.name;
    await this.broadcaster.broadcastExtensionMessage(msg);
  }

  /**
   * Broadcast a cell set update to all clients.
   * @param {String} op - The operation type: "set", "unset", or "update"
   * @param {String} mapName - The map which this cell set applies to.
   * @param {CellSet} cellSet - The cell set object.
   */
  async broadcastCellSetUpdateToAllUser(op, mapName, cellSet) {
    await this.broadcaster.notifyPlayerCellSetChange(op, mapName, cellSet);
  }

  /**
   * Check the player's permission.
   */
  async checkPerm(playerID, scope) {
    const token = await this.getToken(playerID);
    let scp = token.scp;
    if (!Array.isArray(scp)) {
      scp = token.scope;
    }
    if (typeof scp === 'string') {
      scp = scp.split(' ');
    }
    if (!Array.isArray(scp)) return false;
    if (scp.includes(scope)) return true;
    return false;
  }

  /**
   * Get the player's current location. (As perceived by this extension).
   * Return undefined if not found, otherwise, return the MapCoord.
   */
  async getPlayerLocation(playerID) {
    const p = this.gameState.getPlayer(playerID);
    if (p === null) {
      return undefined;
    }
    return p.mapCoord;
  }
}

export default ExtensionHelperBase;
