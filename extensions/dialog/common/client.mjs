// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from '/static/sites/game-client/ui/modal.mjs';

const DIALOG_DIV = 'dialog-div';
const DIALOG_MSG_DIV = 'dialog-msg';
const DIALOG_SUBJECT_DIV = 'dialog-subject';
const DIALOG_BUTTON_CONTAINER_DIV = 'dialog-btn-container';

class DialogModal extends Modal {
  constructor(mainUI) {
    const DOM = document.getElementById(DIALOG_DIV);
    super(mainUI, DOM);

    this.msgDOM = document.getElementById(DIALOG_MSG_DIV);
    this.subjectDOM = document.getElementById(DIALOG_SUBJECT_DIV);
    this.btnContDOM = document.getElementById(DIALOG_BUTTON_CONTAINER_DIV);
  }

  async _displayDialogInternal(setupDOM) {
    if (this.isActive()) {
      console.warn('Dialog already active, cannot displayAsSingleChoice');
      return false;
    }

    const btnList = setupDOM();

    let triggered = false;
    const p = new Promise((resolve, reject) => {
      for (const btn of btnList) {
        const f = (btn) => {
          // Extra layer of closure so we can pass btn in.
          return () => {
            if (!triggered) {
              triggered = true;
              this.hide();
              resolve(btn);
            }
            return true;
          };
        };
        btn.addEventListener('click', f(btn) );
      }
    });

    this.show();

    return await p;
  }

  /**
   * Call to set the dialog to display a single choice dialog.
   */
  async displayAsSingleChoice(subject, message, buttonText) {
    const result = await this._displayDialogInternal(() => {
      this.subjectDOM.innerHTML = subject;
      this.msgDOM.innerHTML = message;

      // TODO: Sanitize to prevent XSS
      this.btnContDOM.innerHTML = `<button id="dialog-btn-OK">${buttonText}</button>`;
      const btnOK = document.getElementById('dialog-btn-OK');

      // Set the visibilities right.
      this.btnContDOM.classList.add('visible');

      return [btnOK];
    });

    if (result === false) return {cancelled: true};
    return {ok: true};
  }

  /**
   * Call to set the dialog to display a multi choice dialog.
   */
  async displayAsMultiChoice(subject, message, choices) {
    const result = await this._displayDialogInternal(() => {
      this.subjectDOM.innerHTML = subject;

      let choicesHTML = '<ul>';
      for (const {token, display} of choices) {
        
        // TODO: Sanitize to prevent XSS
        choicesHTML += `<li data-token=${token} id="dialog-btn-${token}" `;
        choicesHTML += `class="dialog-choice-entry">${display}</li>`;
      }
      choicesHTML += '</ul>';
      this.msgDOM.innerHTML = message + '<br />' + choicesHTML;

      // Set the visibilities right.
      this.btnContDOM.classList.remove('visible');

      const btnList = [];
      for (const {token, display} of choices) {
        btnList.push(document.getElementById(`dialog-btn-${token}`));
      }

      return btnList;
    });

    if (result === false) return {cancelled: true};
    return {token: result.dataset.token};
  }

  /**
   * Call to set the dialog to display an single line open-ended prompt.
   */
  async displayAsPrompt(subject, message, buttonText) {
    const result = await this._displayDialogInternal(() => {
      this.subjectDOM.innerHTML = subject;
      const promptHtml = '<br /><input type="text" class="dialog-textinput"' +
        ' id="dialog-textinput" />';
      this.msgDOM.innerHTML = message + promptHtml;

      // TODO: Sanitize to prevent XSS
      this.btnContDOM.innerHTML = `<button id="dialog-btn-OK">${buttonText}</button>`;
      const btnOK = document.getElementById('dialog-btn-OK');

      // Set the visibilities right.
      this.btnContDOM.classList.add('visible');

      return [btnOK];
    });

    if (result === false) return {cancelled: true};
    return {msg: document.getElementById('dialog-textinput').value};
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
    document.getElementById('c2sButton').addEventListener('click', () => {this.getNpcData();});
  }

  /**
   * Called on game start.
   */
  async gameStart() {
    this.modal = new DialogModal(this.helper.mainUI);
  }

  /**
   * Show the single choice dialog to user.
   *
   * WARNING: Message is *not* sanitized before showing the user.
   * Please ensure any client-controllable message is sanitized before
   * calling to avoid XSS.
   *
   * @param {String} subject - The subject of the dialog.
   * @param {String} message - The message to show.
   * @param {String} btnText - The label of the OK button.
   * @return {Object} result - The object will contain 'ok' attribute if
   * the user clicked OK. Otherwise, it'll contain 'cancelled' attribute to
   * denote that the dialog was cancelled.
   */
  async s2c_showDialog(subject, message, btnText) {
    console.log(`[Dialog] Single Choice Dialog`);

    if (!btnText) {
      btnText = 'OK';
    }
    if (!subject) {
      subject = 'Message';
    }
    return await this.modal.displayAsSingleChoice(
      subject, message, btnText);
  }

  /**
   * Show the multi-choice dialog to user.
   *
   * WARNING: Message is *not* sanitized before showing the user.
   * Please ensure any client-controllable message is sanitized before
   * calling to avoid XSS.
   *
   * @param {String} subject - The subject of the dialog.
   * @param {String} message - The message to show.
   * @param {Array} choices - An array of choices, each choice should be an
   * object, and have the following attributes:
   * - token: The token to return if it is selected. It should be a simple
   *          alphanumeric string.
   * - display: What to show to the user, it should be a segment of HTML.
   * @return {Object} result - The object will contain 'token' attribute if
   * the user selected one of the choices. Otherwise, it'll contain 'cancelled'
   * denote to note that the dialog was cancelled.
   */
  async s2c_showDialogWithMultichoice(subject, message, choices) {
    console.log(`[Dialog] Multi Choice Dialog`);

    if (!subject) {
      subject = 'Choices';
    }
    if (!message) {
      message = 'Please select one of the following';
    }
    if (!choices) {
      choices = [{token: 'default', display: 'The default choice.'}];
    }
    return await this.modal.displayAsMultiChoice(
      subject, message, choices);
  }

  /**
   * Show the dialog to display an single line open-ended prompt.
   *
   * WARNING: Message is *not* sanitized before showing the user.
   * Please ensure any client-controllable message is sanitized before
   * calling to avoid XSS.
   *
   * @param {String} subject - The subject of the dialog.
   * @param {String} message - The message to show.
   * @param {String} btnText - The label of the OK button.
   * @return {Object} result - The object will contain 'input' attribute if
   * the user entered something and clicked OK. Otherwise, it'll contain
   * 'cancelled' attribute to denote that the dialog was cancelled.
   */
  async s2c_showDialogWithPrompt(subject, message, btnText) {
    console.log(`[Dialog] Prompt Dialog`);

    if (!btnText) {
      btnText = 'OK';
    }
    if (!subject) {
      subject = 'Input';
    }
    return await this.modal.displayAsPrompt(
      subject, message, btnText);
  }
};

export default Client;
