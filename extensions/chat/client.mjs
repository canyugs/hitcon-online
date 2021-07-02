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
    return function(evt){
      if(evt.keyCode == 13){
        let id = document.getElementById('chat_message');
        client.helper.callC2sAPI('broadcastMessage', {'msg': id.value}, 5000);
        id.value = '';
      }
    }
  }

  onExtensionBroadcast(arg){
    document.getElementById('message_history').innerHTML += '<span>' + encodeURI(arg.msg) + '</span><br>';
  }

  /**
   * Returns true if this extension have a browser side part.
   * If this returns false, the constructor for Client will not be called.
   * @return {Boolean} haveClient - See above.
   */
  static haveClient() {
    return false;
  }
};

export default Client;
