// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const CHAT_DIV = 'chat-overlay';

class ChatOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(CHAT_DIV);
    super(mainUI, dom);
  }

  // TODO(zeze-zeze): Expand on this class (jsdoc and implementation) and
  // implement onPre/PostShow/Hide() as needed.
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
  }

  send_msg(client){
    return async function(evt){
      if(evt.keyCode == 13){
        let message_to_id = document.getElementById('message_to');
        let chat_message_id = document.getElementById('chat_message');
        if(chat_message_id.value.substring(0, 2) == "!/"){
            client.handleCommand(chat_message_id.value.trim());
        }
        else if(message_to_id.value){
          client.helper.callC2sAPI(null, 'privateMessage', 5000, {'msg_to': message_to_id.value, 'msg': chat_message_id.value});
        }
        else{
          client.helper.callC2sAPI(null, 'broadcastMessage', 5000, {'msg': chat_message_id.value});
        }
        chat_message_id.value = '';
      }
    }
  }
    
  listCommand(){
    document.getElementById('message_history').innerHTML += "<pre>" + 
    this.HTMLEncode(`
Usage: !/<Command> <arg1> <arg2> ...
  !/teleport <Map> <x> <y>    Teleport to the map Map at coordinate (x, y)
  !/help                List command usages
    `) + "</pre>";
    
  }

  handleCommand(cmd){
    if(cmd == '!/help'){
      this.listCommand();
    }
    else if(cmd.split(" ")[0] == '!/teleport'){
      var mapCoord = this.helper.gameClient.playerInfo.mapCoord;
      mapCoord.mapName = cmd.split(" ")[1];
      mapCoord.x = cmd.split(" ")[2];
      mapCoord.y = cmd.split(" ")[3];
      if(isNaN(parseInt(mapCoord.x, 10)) || isNaN(parseInt(mapCoord.y, 10))){
        document.getElementById('message_history').innerHTML += '<span>Invalid Coordinate</span><br>';
        this.listCommand();
      }
      else{
        this.helper.callC2sAPI(null, 'teleport', 5000, mapCoord);
      }
    }
    else{
      document.getElementById('message_history').innerHTML += '<span>Invalid Command</span><br>';
      this.listCommand();
    }
  }

  HTMLEncode(str){
    return $('<div/>').text(str).html()
  }

  s2c_getPrivateMessage(arg){
    document.getElementById('message_history').innerHTML += '<span>Private Message From ' + this.HTMLEncode(arg.msg_from) + ': ' + this.HTMLEncode(arg.msg) + '</span><br>';
  }

  s2c_sendedPrivateMessage(arg){
    document.getElementById('message_history').innerHTML += '<span>Private Message To ' + this.HTMLEncode(arg.msg_to) + ': ' + this.HTMLEncode(arg.msg) + '</span><br>';
  }

  onExtensionBroadcast(arg){
    arg.msg_from = $('<div/>').text(arg.msg_from).html()
    arg.msg = $('<div/>').text(arg.msg).html()
    document.getElementById('message_history').innerHTML += '<span>' + arg.msg_from + ': ' + arg.msg + '</span><br>';
  }
};

export default Client;
