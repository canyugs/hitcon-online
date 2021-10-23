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
    this.visibleCmds = {};
    this.hiddenCmds = {};
    this.clientCmdsInfo = {};
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    this.registerCommand({cmd: 'teleport',
      helpMsg: '<Map> <x> <y> --- Teleport to the map Map at coordinate (x, y)',
      ext: this.helper.name, c2s: 'cmdTeleport'});
    this.registerCommand({cmd: 'announce',
      helpMsg: '<message> --- announce a message to all users',
      ext: this.helper.name, c2s: 'cmdAnnounce'});
  }

  /**
   * Handle commands that are hidden.
   * @c2s_otherCommands
   * @param {string} cmd - command input by user with argument.
   * @return {object} result - result.status:
   * - 'ok': Command has been run.
   * - 'c2s': Client should invoke the given c2s API in result.ext and result.c2s.
   * - '404': No such command.
   */
  async c2s_otherCommands(player, cmd) {
    if (typeof cmd !== 'string') {
      console.warn(`c2s_otherCommands() invoked with invalid cmd: `, cmd);
    }
    let cmdObj = undefined;
    const rawCmd = cmd.split(' ')[0].substr(2);
    if (rawCmd in this.hiddenCmds) {
      cmdObj = this.hiddenCmds[rawCmd];
    } else if (rawCmd in this.visibleCmds) {
      cmdObj = this.visibleCmds[rawCmd];
    } else {
      return {status: '404'};
    }

    if (typeof cmdObj.c2s === 'string') {
      return {status: 'c2s', c2s: cmdObj.c2s, ext: cmdObj.ext};
    }

    if (typeof cmdObj.s2s === 'string') {
      return await this.handleS2sCommand(player, cmd, cmdObj);
    }

    console.error(`${cmdObj.cmd} doesn't have s2s or c2s specified.`);
    return {status: '404'};
  }

  /**
   * Handle a command with s2s handler.
   */
  async handleS2sCommand(player, cmd, cmdObj) {
    let result = {};

    // Check permission.
    let havePerm = false;
    if (typeof cmdObj.scope === 'string') {
      havePerm = await this.helper.checkPerm(player.playerID, cmdObj.scope);
    } else {
      havePerm = true;
    }

    // Make the s2s call if have permission.
    if (havePerm) {
      result = await this.helper.callS2sAPI(cmdObj.ext, cmdObj.s2s,
 player.playerID, cmd);
    } else {
      result  = {status: 'noperm'};
    }

    // Check result and reply.
    if (typeof result !== 'object' || typeof result.status !== 'string') {
      console.warn(`Command ${cmd} by user ${player.playerID} failed: `, result);
    }
    if (result.status !== 'ok' && result.status !== 'error' && result.status !== 'noperm') {
      console.warn(`Command ${cmd} calling ${cmdObj.ext}.s2s_${cmdObj.s2s} results in invalid status ${result.status}: `, result);
      result.status = 'error';
    }
    const ret = {status: result.status};
    if (typeof result.reply === 'string') {
      ret.reply = result.reply;
    }
    return ret;
  }

  /**
   * Signature for c2s and s2s command handler.
   * c2s_XXX(player, cmd)
   * s2s_XXX(srcExt, player, cmd)
   * cmd is the raw cmd.
   * Both returns an object result.
   * result.status:
   * - 'ok': Command runs without issue. result.reply may be available.
   * - 'error': Error occurred, see result.reply.
   * - 'noperm': No permission. result.reply will be ignore and user will be notified.
   */

  /**
   * Register a chat command.
   * cmdInfo:
   * - cmd: The string used to activate the command. i.e. `!/${cmd} ...`
   * - helpMsg: A string that is the help message. i.e. `<x> <y> -- Teleport the user.`
   * - ext: The extension to call when this is triggered.
   * - c2s: The name of the c2s API to call. Fill one of this or s2s.
   * - s2s: The name of the s2s API to call. Fill one of this or c2s.
   * - scope: The jwt scope required to invoke. This is checked for s2s only.
   * NOTE: c2s API should enforce this, caller will NOT check this.
   */
  async registerCommand(cmdInfo) {
    let hidden = cmdInfo.hidden;
    if (typeof hidden !== 'boolean') {
      hidden = false;
    }

    const cmd = cmdInfo.cmd;
    if (typeof cmd !== 'string') {
      console.error('Invalid command in chat.registerCommand: ', cmd);
      return false;
    }
    if (hidden) {
      this.hiddenCmds[cmd] = cmdInfo;
    } else {
      this.visibleCmds[cmd] = cmdInfo;
    }

    await this._updateClientCmdsInfo();
    return true;
  }

  /**
   * Rebuild the clientCmdsInfo.
   */
  async _updateClientCmdsInfo() {
    this.helpMsg = 'Usage: \n';
    for (const c in this.visibleCmds) {
      const cmd = this.visibleCmds[c].cmd;
      const helpMsg = this.visibleCmds[c].helpMsg;
      this.helpMsg += `  !/${cmd} ${helpMsg}\n`;
    }

    let tbl = [];
    for (const c in this.visibleCmds) {
      const obj = this.visibleCmds[c];
      const cobj = {};
      if (typeof obj.c2s === 'undefined') {
        // Not needed.
        continue;
      }
      cobj.cmd = obj.cmd;
      cobj.ext = obj.ext;
      cobj.c2s = obj.c2s;
      tbl.push(cobj);
    }

    this.clientCmdsInfo = {table: tbl, helpMsg: this.helpMsg};
    const bmsg = {};
    bmsg['type'] = 'clientCmdsInfo';
    bmsg['clientCmdsInfo'] = this.clientCmdsInfo; 
    await this.helper.broadcastToAllUser(bmsg);
  }

  /**
   * Client can call this to fetch the client command informations.
   */
  async c2s_getClientCmdsInfo(player) {
    return this.clientCmdsInfo;
  }

  /**
   * Broadcast the chat message to all players
   * @c2s_broadcastMessage
   * @param {Player} player - player information
   * @param {object} args - chat information including message
   */
  async c2s_broadcastMessage(player, args) {
    let resultArgs = {};
    resultArgs['type'] = 'genericMsg';
    resultArgs['msg_from'] = player.playerID;
    resultArgs['msg'] = args.msg;
    
    await this.helper.broadcastToAllUser(resultArgs);
  }

  /**
   * This command makes an announcement.
   * @param {Player} player - player information
   * @param {String} cmd - The full command with syntax:
   *   !/announce <msg>
   */
  async c2s_cmdAnnounce(player, cmd) {
    if (!await this.helper.checkPerm(player.playerID, 'mod')) {
      return {status: 'noperm'};
    }
    const msg = cmd.substr(cmd.indexOf(' ')+1);

    let resultArgs = {};
    resultArgs['msg_from'] = player.playerID;
    resultArgs['msg'] = msg;
    resultArgs['type'] = 'announcement';
    resultArgs['timeout'] = 25000;
    
    await this.helper.broadcastToAllUser(resultArgs);

    return {status: 'ok'};
  }

  /**
   * Check every player's position and send message to them if they are nearby the sender
   * @c2s_nearbyMessage
   * @param {Player} player - player information
   * @param {object} args - nearby message including msg
   */
  async c2s_nearbyMessage(player, args) {
    const centerPlayerCoord = this.helper.gameState.getPlayer(player.playerID).mapCoord;
    if (!centerPlayerCoord) {
      console.error('Cannot find target player id');
      return;
    }

    args['msg_from'] = player.playerID;
    this.helper.gameState.players.forEach(async (value, key, map) => {
      // TODO(zeze-zeze): Check the definition of "nearby". Now is equal to or less than two blocks in x, y coordinates.
      if (Math.abs(value.mapCoord.x - centerPlayerCoord.x) <= 2 && Math.abs(value.mapCoord.y - centerPlayerCoord.y) <= 2) {
        await this.helper.callS2cAPI(value.playerID, 'chat', 'getNearbyMessage', 5000, args);
      }
    });
  }

  /**
   * Send the chat message to specified player
   * @c2s_privateMessage
   * @param {Player} player - player information
   * @param {object} args - chat information including message, target player id
   */
  async c2s_privateMessage(player, args) {
    args['msg_from'] = player.playerID;
    await this.helper.callS2cAPI(args.msg_to, 'chat', 'getPrivateMessage', 5000, args);
    await this.helper.callS2cAPI(player.playerID, 'chat', 'sendedPrivateMessage', 5000, args);
  }

  /**
   * A command that teleports the player to the specified coordinate.
   * @param {Player} player - player information
   * @param {String} cmd - The full command with syntax:
   *   !/teleport <world> <x> <y>
   */
  async c2s_cmdTeleport(player, cmd) {
    if (!await this.helper.checkPerm(player.playerID, 'mod')) {
      return {status: 'noperm'};
    }
    const mapCoord = {};
    const arr = cmd.split(' ');
    if (arr.length != 4) {
      return {status: 'error', reply: 'Invalid arguments'};
    }
    mapCoord.mapName = arr[1];
    mapCoord.x = parseInt(arr[2], 10);
    mapCoord.y = parseInt(arr[3], 10);
    if (isNaN(mapCoord.x) || isNaN(mapCoord.y)) {
      return {status: 'error', reply: 'Invalid coordinate'};
    }

    await this.helper.teleport(player.playerID, mapCoord);
    return {status: 'ok'};
  }

  /**
   * Register a chat command.
   * See this.registerCommand() for more info on cmdInfo.
   */
  async s2s_registerCmd(srcExt, cmdInfo) {
    return await this.registerCommand(cmdInfo);
  }
}

export default Standalone;
