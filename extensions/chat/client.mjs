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
    document.getElementById('chat_message').addEventListener('keypress', this.send_msg(this));
  }

  send_msg(client){
    return async function(evt){
      if(evt.keyCode == 13){
        let message_to_id = document.getElementById('message_to');
        let chat_message_id = document.getElementById('chat_message');
        if(message_to_id.value){
          client.helper.callC2sAPI(null, 'privateMessage', 5000, {'msg_to': message_to_id.value, 'msg': chat_message_id.value});
          chat_message_id.value = '';
        }
        else{
          client.helper.callC2sAPI(null, 'broadcastMessage', 5000, {'msg': chat_message_id.value});
          chat_message_id.value = '';
        }
      }
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
