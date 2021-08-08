// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from '/static/sites/game-client/ui/modal.mjs';

const DIALOG_DIV = 'dialog-div';
const DIALOG_MSG_DIV = 'dialog-msg';
const DIALOG_SUBJECT_DIV = 'dialog-subject';
const DIALOG_BUTTON_CONTAINER_DIV = 'dialog-btn-container';

class DialogModal extends Modal {
  constructor(mainUI) {
    const dom = document.getElementById(DIALOG_DIV);
    super(mainUI, dom);

    this.msgDom = document.getElementById(DIALOG_MSG_DIV);
    this.subjectDom = document.getElementById(DIALOG_SUBJECT_DIV);
    this.btnContDom = document.getElementById(DIALOG_BUTTON_CONTAINER_DIV);    
  }

  /**
   * Call to set the dialog to display a single choice dialog.
   */
  async displayAsSingleChoice(subject, message, buttonText) {
    if (this.isActive()) {
      console.warn('Dialog already active, cannot displayAsSingleChoice');
      return false;
    }

    if (!subject) {
      subject = 'Message';
    }
    if (!buttonText) {
      buttonText = 'OK';
    }
    this.subjectDom.innerHTML = subject;
    this.msgDom.innerHTML = message;
    this.btnContDom.innerHTML = `<button id="dialog-btn-OK">${buttonText}</button>`;
    const btnOK = document.getElementById('dialog-btn-OK');

    const p = new Promise((resolve, reject) => {
      btnOK.addEventListener('click', () => {
        this.hide();
        resolve(true);
        return true;
      });
    });

    this.show();

    return await p;
  }

  /**
   * Called after it's shown.
   */
  onPostShow() {
    // Set the size.
    this.setSize('80%', '25%');
    this.setPosition('10%', '55%');
    return true;
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
    document.getElementById('c2sButton').addEventListener('click', () => {
      this.getNpcData();
    });
  }

  /**
   * Called on game start.
   */
  async gameStart() {
    this.modal = new DialogModal(this.helper.mainUI);
  }

  /**
   * Get the NPC data from Server (npc.json)
   */
  getNpcData() {
    console.log('[c2s Button] getNpcData');
    const arg = {'npc': 'Amy'}; // for test

    this.helper.callC2sAPI(null, 'getSpecificNpcData', 5000, arg);
  }

  /**
   * Show the single choice dialog to user.
   *
   * WARNING: Message is *not* sanitized before showing the user.
   * Please ensure any client-controllable message is sanitized before
   * calling to avoid XSS.
   *
   * @param {object} arg - Should contain the following:
   * {String} subject - The subject of the dialog.
   * {String} message - The message to show.
   * {String} btnText - The label of the OK button.
   */
  async s2c_singleChoiceDialog(arg) {
    console.log(`[Dialog] Single Choice Dialog`);
    return await this.modal.displayAsSingleChoice(
      arg.subject, arg.message, arg.btnText);
  }


  /**
   * Show the multi choice dialog to user.
   * @param {object} arg - npc data.
   */
  s2c_multiChoiceDialog(arg) {
    console.log(`[Dialog] Multi Choice Dialog`);
    let buttonString = '';
    for (const choice of arg.choice) {
      buttonString += `<button id="button">${choice}</button>`;
    }

    // todo: show the pop-up dialog for user

    document.getElementById('npcName').innerHTML = arg.name;
    document.getElementById('npcSentence').innerHTML = arg.sentence;
    document.getElementById('checkButtonDiv').innerHTML = buttonString;
    document.getElementById('checkButtonDiv').addEventListener('click', (e) => {
      this.sendResultToServer(e.target.innerHTML);
    });
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
