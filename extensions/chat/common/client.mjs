// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const CHAT_DIV = 'chat-overlay';

class ChatOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(CHAT_DIV);
    super(mainUI, dom);
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
  }

  async gameStart() {
    this.overlay = new ChatOverlay(this.helper.mainUI);
    this.overlay.show(OverlayPosition.RIGHT);

    this.toolbarButton = new ToolbarButton('/static/extensions/chat/chat.svg');
    this.toolbarButton.registerAsToggle(this.overlay);
    this.toolbarButton.show();
  }

  send_msg(client) {
    return async function(evt) {
      if (evt.keyCode === 13) {
        const message_to_id = document.getElementById('message_to');
        const chat_message_id = document.getElementById('chat_message');
        if (chat_message_id.value.substring(0, 2) === '!/') {
          client.handleCommand(chat_message_id.value.trim());
        } else if (message_to_id.value) {
          client.helper.callC2sAPI(null, 'privateMessage', 5000, {'msg_to': message_to_id.value, 'msg': chat_message_id.value});
        } else {
          client.helper.callC2sAPI(null, 'broadcastMessage', 5000, {'msg': chat_message_id.value});
        }
        chat_message_id.value = '';
      }
    };
  }

  /**
   * List the user command for player
   * @listCommand
   */
  listCommand() {
    document.getElementById('message_history').innerHTML += '<pre>' +
    this.HTMLEncode(`
Usage: !/<Command> <arg1> <arg2> ...
  !/teleport <Map> <x> <y>    Teleport to the map Map at coordinate (x, y)
  !/help                List command usages
    `) + '</pre>';
  }

  /**
   * Handle the command from client
   * @handleCommand
   * @param {string} cmd - the command including arguments
   */
  async handleCommand(cmd) {
    if (cmd === '!/help') {
      this.listCommand();
    } else if (cmd.split(' ')[0] === '!/teleport') {
      const mapCoord = this.helper.gameClient.playerInfo.mapCoord;
      mapCoord.mapName = cmd.split(' ')[1];
      mapCoord.x = cmd.split(' ')[2];
      mapCoord.y = cmd.split(' ')[3];
      if (isNaN(parseInt(mapCoord.x, 10)) || isNaN(parseInt(mapCoord.y, 10))) {
        document.getElementById('message_history').innerHTML += '<span>Invalid Coordinate</span><br>';
        this.listCommand();
      } else {
        this.helper.callC2sAPI(null, 'teleport', 5000, mapCoord);
      }
    } else {
      const result = await Promise.resolve(this.helper.callC2sAPI(null, 'otherCommands', 5000));
      if (result.state) {
        document.getElementById('message_history').innerHTML += '<span>' + this.HTMLEncode(result) + '</span><br>';
      } else {
        document.getElementById('message_history').innerHTML += '<span>Invalid Command</span><br>';
        this.listCommand();
      }
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
   * Get a private message from other player
   * @s2c_getPrivateMessage
   * @param {object} arg - Information of the private message
   */
  s2c_getPrivateMessage(arg) {
    document.getElementById('message_history').innerHTML += '<span>Private Message From ' + this.HTMLEncode(arg.msg_from) + ': ' + this.HTMLEncode(arg.msg) + '</span><br>';
  }

  /**
   * Display a private message after sending the private message to other player
   * @s2c_senderPrivateMessage
   * @param {object} arg - Information of the private message
   */
  s2c_sendedPrivateMessage(arg) {
    document.getElementById('message_history').innerHTML += '<span>Private Message To ' + this.HTMLEncode(arg.msg_to) + ': ' + this.HTMLEncode(arg.msg) + '</span><br>';
  }

  /**
   * Get a Broadcast message
   * @onExtensionBroadcast
   * @param {object} arg - Information of the broadcast message
  */
  onExtensionBroadcast(arg) {
    arg.msg_from = $('<div/>').text(arg.msg_from).html();
    arg.msg = $('<div/>').text(arg.msg).html();
    document.getElementById('message_history').innerHTML += '<span>' + arg.msg_from + ': ' + arg.msg + '</span><br>';
  }
}

export default Client;
