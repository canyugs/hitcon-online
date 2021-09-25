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

    this.toolbarButton = new ToolbarButton('/static/extensions/chat/common/chat.svg');
    this.toolbarButton.registerAsToggle(this.overlay);
    this.toolbarButton.show();
  }

  /**
   * Send message to one of the channels.
   * @send_msg
   * @param {client} - The pointer of this Client class
   */
  send_msg(client) {
    return async function(evt) {
      if (evt.keyCode === 13) {
        const message_to_id = document.getElementById('message_to');
        const chat_message_id = document.getElementById('chat_message');
        if (chat_message_id.value.substring(0, 2) === '!/') {
          client.handleCommand(chat_message_id.value.trim());
          // TODO(zeze-zeze): Use drop down menu to replace it
        } else if (message_to_id.value.toLowerCase() == 'nearby') {
          await client.helper.callC2sAPI('chat', 'nearbyMessage', 5000, {'msg': chat_message_id.value});
        } else if (message_to_id.value) {
          await client.helper.callC2sAPI('chat', 'privateMessage', 5000, {'msg_to': message_to_id.value, 'msg': chat_message_id.value});
        } else {
          await client.helper.callC2sAPI('chat', 'broadcastMessage', 5000, {'msg': chat_message_id.value});
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
  !/announce <message>        announce a message to all users
  !/teleport <Map> <x> <y>    Teleport to the map Map at coordinate (x, y)
  !/help                      List command usages
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
      mapCoord.x = parseInt(cmd.split(' ')[2], 10);
      mapCoord.y = parseInt(cmd.split(' ')[3], 10);
      if (isNaN(mapCoord.x) || isNaN(mapCoord.y)) {
        document.getElementById('message_history').innerHTML += '<span>Invalid Coordinate</span><br>';
        this.listCommand();
      } else {
        this.helper.callC2sAPI(null, 'teleport', 5000, mapCoord);
      }
    } else if (cmd.split(' ')[0] === '!/announce') { // TODO: restrict this using permission to admin
      const msg = cmd.substring(10);
      if (msg.trim() === '') {
        document.getElementById('message_history').innerHTML += '<span>Invalid message</span><br>';
        this.listCommand();
      } else {
        //this.helper.callC2sAPI(null, 'announce', 5000, msg);
        this.helper.callC2sAPI(null, 'broadcastMessage', 5000, {'msg': msg, 'type': 'announcement'});
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
   * Get nearby message from server
   * @s2c_getNearbyMessage
   * @param {object} args - Information of the nearby message including msg_from and msg
   */
  s2c_getNearbyMessage(args) {
    document.getElementById('message_history').innerHTML += '<span>Nearby Message From ' + this.HTMLEncode(args.msg_from) + ': ' + this.HTMLEncode(args.msg) + '</span><br>';
  }

  /**
   * Get a private message from other player
   * @s2c_getPrivateMessage
   * @param {object} args - Information of the private message
   */
  s2c_getPrivateMessage(args) {
    document.getElementById('message_history').innerHTML += '<span>Private Message From ' + this.HTMLEncode(args.msg_from) + ': ' + this.HTMLEncode(args.msg) + '</span><br>';
  }

  /**
   * Display a private message after sending the private message to other player
   * @s2c_senderPrivateMessage
   * @param {object} args - Information of the private message
   */
  s2c_sendedPrivateMessage(args) {
    document.getElementById('message_history').innerHTML += '<span>Private Message To ' + this.HTMLEncode(args.msg_to) + ': ' + this.HTMLEncode(args.msg) + '</span><br>';
  }

  /**
   * Get a Broadcast message
   * @onExtensionBroadcast
   * @param {object} args - Information of the broadcast message
  */
  onExtensionBroadcast(args) {
    if (args.type === 'announcement') {
      //this.mainUI.showAnnouncement(args.msg,3000); // it doesn't work
      game.mainUI.showAnnouncement(args.msg, 3000);
    } else {
      args.msg_from = $('<div/>').text(args.msg_from).html();
      args.msg = $('<div/>').text(args.msg).html();
      document.getElementById('message_history').innerHTML += '<span>' + args.msg_from + ': ' + args.msg + '</span><br>';
    }
  }

}

export default Client;
