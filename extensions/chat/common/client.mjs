// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import UtilPanelTab from '/static/sites/game-client/ui/utilpanel/utilpanel-tab.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const CHAT_DIV = 'chat-overlay';
const ICON_SVG = '/static/extensions/chat/common/chat.svg';

class ChatTab extends UtilPanelTab {
  constructor(mainUI) {
    const dom = document.getElementById(CHAT_DIV);
    super(mainUI.utilPanelManager, dom, 'chat', ICON_SVG);
  }
};


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
    document.getElementById('chat_message').addEventListener('keypress', this.send_msg(this));
    document.getElementById('send_msg').addEventListener('click', this.send_msg(this));
    this.clientCmdsInfo = {};
  }

  async gameStart() {
    this.tab = new ChatTab(this.helper.mainUI);
    this.helper.mainUI.contextMenu.addToOthersMenu('Private Chat', '/static/extensions/chat/common/chat.svg', (player) => {
      startPrivateMessage(player.playerID);
    });
    this.clientCmdsInfo = await this.helper.callC2sAPI(null, 'getClientCmdsInfo', this.helper.defaultTimeout);
  }

  /**
   * Send message to one of the channels.
   * @send_msg
   * @param {client} - The pointer of this Client class
   */
  send_msg(client) {
    return async (evt) => {
      if (evt.keyCode === 13 || evt.pointerType === 'mouse') {
        const display_name = client.helper.gameClient.playerInfo._displayName;
        const message_to_id = document.getElementById('message_to');
        const chat_message_id = document.getElementById('chat_message');
        const message = chat_message_id.value;
        chat_message_id.value = '';
        
        // Check if the message is empty exclusive of whitespace
        if (message.trim().length === 0) {
          return;
        }

        const msg_info = {'msg_from_name': display_name, 'msg': message};
        
        if (message.substring(0, 2) === '!/') {
          client.handleCommand(message.trim());
          // TODO(zeze-zeze): Use drop down menu to replace it
        } else if (message_to_id.value.toLowerCase() == 'nearby') {
          await client.helper.callC2sAPI('chat', 'nearbyMessage', this.helper.defaultTimeout, msg_info);
        } else if (message_to_id.value) {
          if (client.helper.gameState.getPlayers().has(message_to_id.value)) {
            msg_info.msg_to_id = message_to_id.value;
            msg_info.msg_to_name = client.helper.gameState.getPlayers().get(message_to_id.value)._displayName;
            await client.helper.callC2sAPI('chat', 'privateMessage', this.helper.defaultTimeout, msg_info);
          } else {
            document.getElementById('message_history').prepend(this.generateMessageBox(display_name + ' => ' + message_to_id.value, 'Error: Cannot find target player id', 'private-message'));
          }
        } else {
          await client.helper.callC2sAPI('chat', 'broadcastMessage', this.helper.defaultTimeout, msg_info);
        }
      }
    };
  }

  /**
   * List the user command for player
   * @listCommand
   */
  listCommand() {
    const msg = `
Usage: !/<Command> <arg1> <arg2> ...
${this.clientCmdsInfo.helpMsg}
  !/help -- List command usages
    `;
    return this.appendRawMessage(msg);
  }

  /**
   * Append a raw (unformatted) message to the chat box.
   */
  appendRawMessage(msg) {
    document.getElementById('message_history').prepend(
    this.generateMessageBox('SYSTEM', msg, 'system'));
  }

  /**
   * Handle the command from client
   * @handleCommand
   * @param {string} cmd - the command including arguments
   */
  async handleCommand(cmd) {
    if (cmd === '!/help') {
      this.listCommand();
      return;
    }

    const rawCmd = cmd.split(' ')[0].substr(2);
    if (typeof this.clientCmdsInfo[rawCmd] === 'object' && typeof this.clientCmdsInfo[rawCmd].c2s === 'string') {
      // Command is found.
      return await this.handleC2sCommand(cmd, this.clientCmdsInfo[rawCmd].ext, this.clientCmdsInfo[rawCmd].c2s);
    }

    // Command not found, could be hidden command or command is s2s.
    const result = await this.helper.callC2sAPI(null, 'otherCommands', this.helper.defaultTimeout, cmd);
    if (result.status === 'ok') {
      // Good, no need to tell the user.
      if (typeof result.reply === 'string') {
        this.appendRawMessage(result.reply);
      }
    } else if (result.status === 'c2s') {
      return await this.handleC2sCommand(cmd, result.ext, result.c2s);
    } else if (result.status === '404') {
      this.appendRawMessage(`Command ${rawCmd} not found.`);
    } else {
      console.error(`Invalid response for chat command ${cmd}: `, result);
    }
  }

  /**
   * Handle a command that requires c2s call.
   */
  async handleC2sCommand(cmd, ext, c2s) {
    const rawCmd = cmd.split(' ')[0].substr(2);
    const result = await this.helper.callC2sAPI(ext, c2s, this.helper.defaultTimeout, cmd);
    if (typeof result !== 'object' || typeof result.status !== 'string') {
      this.appendRawMessage(`Command ${rawCmd} failed`);
      console.error(`Command ${rawCmd} failed: `, result);
      return;
    }
    if (result.status === 'ok') {
      // Good.
    } else if (result.status === 'error') {
      if (typeof result.reply !== 'string') {
        result.reply = 'Unknown error';
        console.warn(`No result.reply for handleC2sCommand(${cmd}, ${ext}, ${c2s}): `, result);
      }
      result.reply = 'Error: ' + result.reply;
    } else if (result.status === 'noperm') {
      result.reply = 'No permission to use command';
    } else {
      result.reply = 'Internal error';
      console.warn(`Invalid result from handleC2sCommand(${cmd}, ${ext}, ${c2s}): `, result);
    }
    if (typeof result.reply === 'string') {
      this.appendRawMessage(result.reply);
    }
  }

  /**
   * Encode the html in case of XSS
   * @HTMLEncode
   * @param {string} str - the string being encoded
   */
  HTMLEncode(str) {
    return $('<div/>').text(str).html();
  }


  /**
   * Generate styled dom for message
   * @generateMessageBox
   * @param {string} source - who send this message
   * @param {string} body - message content
   @ @param {string} msgType - label message type
   */
  generateMessageBox(source, body, msgType='') {
    const t = new Date();
    const hour = (t.getHours() < 10 ? '0' : '') + t.getHours();
    const minute = (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
    const currentTime = `${hour}:${minute}`;
    const msgBox = document.getElementById('chat-message-box').cloneNode(true);
    const currentType = msgBox.querySelector('.chat-message-type').classList.toString();
    msgBox.querySelector('.chat-message-type').classList.add(`${currentType}--${msgType}`);
    msgBox.querySelector('.chat-message-type').textContent = msgType;
    msgBox.querySelector('.chat-message-time').textContent = currentTime;
    msgBox.querySelector('.chat-message-body').textContent = body;
    msgBox.querySelector('.chat-message-body').classList.add(`chat-message-body--${msgType}`);
    msgBox.querySelector('.chat-message-source').textContent = source;
    return msgBox;
  }

  /**
   * Get nearby message from server
   * @s2c_getNearbyMessage
   * @param {object} args - Information of the nearby message including msg_from and msg
   */
  s2c_getNearbyMessage(args) {
    document.getElementById('message_history').prepend(
    this.generateMessageBox(this.HTMLEncode(args.msg_from_name), this.HTMLEncode(args.msg), 'nearby'));
  }

  /**
   * Get nearby message from server
   * @s2c_getNearbyMessage
   * @param {object} args - Information of the nearby message including msg_from and msg
   */
  s2c_getNearbyMessage(args) {
    document.getElementById('message_history').prepend(
    this.generateMessageBox(args.msg_from_name, args.msg, 'nearby'));
  }

  /**
   * Get a private message from other player
   * @s2c_getPrivateMessage
   * @param {object} args - Information of the private message
   */
  s2c_getPrivateMessage(args) {
    document.getElementById('message_history').prepend(
    this.generateMessageBox(args.msg_from_name + ' => ' + args.msg_to_name, args.msg, 'private-message'));
  }

  /**
   * Display a private message after sending the private message to other player
   * @s2c_senderPrivateMessage
   * @param {object} args - Information of the private message
   */
  s2c_sendedPrivateMessage(args) {
    document.getElementById('message_history').prepend(
    this.generateMessageBox(args.msg_from_name + ' => ' + args.msg_to_name, args.msg, 'private-message'));
  }

  /**
   * Get a Broadcast message
   * @onExtensionBroadcast
   * @param {object} args - Information of the broadcast message
  */
  onExtensionBroadcast(args) {
    if (args.type === 'announcement') {
      //this.helper.mainUI.showAnnouncement(args.msg, args.timeout); // it still doesn't work
      game.mainUI.showAnnouncement(args.msg, args.timeout);
    } else if (args.type === 'clientCmdsInfo') {
      this.clientCmdsInfo = args.clientCmdsInfo;
    } else if (args.type === 'genericMsg') {
      document.getElementById('message_history').prepend(
    this.generateMessageBox(args.msg_from_name, args.msg, 'all'));
    } else {
      console.error('Invalid chat ext broadcast message: ', args);
    }
  }

}

export default Client;
