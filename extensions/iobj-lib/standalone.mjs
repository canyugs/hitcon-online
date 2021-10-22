// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';

import {randomShuffle, randomChoice} from '../../common/utility/random-tool.mjs';
import InteractiveObjectServerBaseClass from '../../common/interactive-object/server.mjs';

// Bring out the FSM_ERROR for easier reference.
const FSM_ERROR = InteractiveObjectServerBaseClass.FSM_ERROR;

const SF_PREFIX = 's2s_sf_';

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

    // Stores the editable dialog variables
    this.dialogVars = {};
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  /**
   * Register the state func with the extension given.
   */
  async _registerWith(ext) {
    const propList = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
    for (const p of propList) {
      if (typeof this[p] !== 'function') continue;
      if (!p.startsWith(SF_PREFIX)) continue;
      const fnName = p.substr(SF_PREFIX.length);
      this.helper.callS2sAPI(ext, 'registerStateFunc', fnName, this.helper.name, `sf_${fnName}`);
    }
  }

  /**
   * Register all state func available in this extension with the given
   * extension.
   */
  async s2s_reqRegister(srcExt, ext) {
    if (!ext) ext = srcExt;
    await this._registerWith(ext);
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }

  // ==================== State Functions ====================

  /**
   * Show a dialog overlay in client browser.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async s2s_sf_showDialog(srcExt, playerID, kwargs, sfInfo) {
    const {dialogs, dialogVar, options} = kwargs;
    // prepare dialog
    let d = '';
    if (typeof dialogs === 'string') d = dialogs;
    if (Array.isArray(dialogs)) d = randomChoice(dialogs);
    if (typeof dialogVar === 'string' && typeof this.dialogVars[dialogVar] === 'string') d = this.dialogVars[dialogVar];

    // prepare choice
    const c = [];
    for (const [message, nextState] of Object.entries(options)) {
      c.push({token: nextState, display: message});
    }

    const result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000, sfInfo.objectName, d, c);
    if (result.token) return result.token;
    console.warn(`Player '${playerID}' does not choose in 'showDialogWithMultichoice'. Result: ${JSON.stringify(result)}`);

    // If we reach here, the showDialog timeouts.
    return FSM_ERROR;
  }

  /**
   * Show an open-ended dialog and check if the entered value is
   * the same as the result.
   */
  async s2s_sf_showDialogAndCheckKey(srcExt, playerID, kwargs, sfInfo) {
    const {nextState, nextStateIncorrect, dialog, key} = kwargs;
    const res = await this.helper.callS2cAPI(playerID, 'dialog',
    'showDialogWithPrompt', 60*1000, sfInfo.objectName, dialog);
    if (res.msg === key) return nextState;

    //The key is wrong,
    return nextStateIncorrect;
  }

  /**
   * Randomly draw from a set of problems, and move to the correct state
   * only when the player correctly answers goalPoints of them.
   */
  async s2s_sf_answerProblems(srcExt, playerID, kwargs, sfInfo) {
    const {problems, goalPoints, nextState, nextStateIncorrect} = kwargs;
    let problemSet = JSON.parse(fs.readFileSync('items/problems.json'));
    randomShuffle(problemSet);
    let result, correct = 0, d = '';
    for (let i = 0; i < problems; i++) {
      const c = [];
      d = problemSet[i].dialogs;
      for (const option of problemSet[i].options) {
        c.push({token: option[0], display: option});
      }
      result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000, this.objectName, d, c);
      if (!result.token) {
        console.warn(`Player '${playerID}' does not choose in 'answerProblems'. Result: ${JSON.stringify(result)}`);
        return FSM_ERROR;
      } else if (result.token === problemSet[i].ans) correct += 1;
    }
    if (correct >= goalPoints) return nextState;
    return nextStateIncorrect;
  }
}

export default Standalone;
