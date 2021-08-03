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
    document.getElementById('c2sButton').addEventListener('click', () => {this.getNpcData();});
  }

  /**
   * Get the NPC data from Server (npc.json)
   */
  getNpcData() {
    console.log('[c2s Button] getNpcData');
    let arg = {'npc': 'Amy'}; //for test

    this.helper.callC2sAPI(null, 'getSpecificNpcData', 5000, arg);
  }

  /**
   * Show the single choice dialog to user.
   * @param {object} arg - npc data.
   */
  s2c_singleChoiceDialog(arg) {
    console.log(`[Dialog] Single Choice Dialog`);

    document.getElementById('npcName').innerHTML = arg.name;
    document.getElementById('npcSentence').innerHTML = arg.sentence;

    //todo: show the pop-up dialog for user
  }


  /**
   * Show the multi choice dialog to user.
   * @param {object} arg - npc data.
   */
  s2c_multiChoiceDialog(arg) {
    console.log(`[Dialog] Multi Choice Dialog`);
    let buttonString = '';
    for (let choice of arg.choice) {
      buttonString += `<button id="button">${choice}</button>`;
    }

    //todo: show the pop-up dialog for user

    document.getElementById('npcName').innerHTML = arg.name;
    document.getElementById('npcSentence').innerHTML = arg.sentence;
    document.getElementById('checkButtonDiv').innerHTML = buttonString;
    document.getElementById('checkButtonDiv').addEventListener('click', e => {this.sendResultToServer(e.target.innerHTML);});
  }

  /**
   * Send the user choice to Server.
   * @param result - user choice.
   */
  sendResultToServer(result) {
    this.helper.callC2sAPI(null, 'getResultFromClient', 5000, {'result': result});
  }

};

export default Client;
