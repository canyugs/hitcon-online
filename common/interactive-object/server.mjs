// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import {MapCoord} from '../maplib/map.mjs';

/**
 * TODO
 * @param {Object} initialPosition - TODO
 * @return {Boolean}
 */
function initialPositionValidation(initialPosition) {
  // TODO
  return true;
}

/**
 * TODO
 * @param {Object} fsm - TODO
 * @return {Boolean}
 */
function fsmValidation(fsm) {
  // TODO

  // for (const attr of ['initialState', 'states']) {
  //   if (!(attr in fsm)) {
  //     console.error(`missing attribute '${attr}' of FSM`);
  //     return false;
  //   }
  // }

  // for (const [name, state] of Object.entries(fsm.states)) {
  //   for (const attr of ['func', 'kwargs']) {
  //     if (!(attr in state)) {
  //       console.error(`missing attribute '${attr}' of state '${name}'`);
  //       return false;
  //     }
  //   }
  //   // TODO: security concern of using eval()
  //   if (typeof eval(state.func) !== 'function') {
  //     console.error(`'${state.func}' is not a valid function.`);
  //     return false;
  //   }

  //   state.name = name;
  // }

  // return true;
  return true;
}

/**
 * TODO
 * @param {Object} display - TODO
 * @return {Boolean}
 */
function displayValidation(display) {
  // TODO
  return true;
}

/**
 * TODO: jsdoc
 */
class InteractiveObjectServerBaseClass {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   * @param {String} objectName - The name of this interactive object.
   * @param {String} configFilePath - The path of the config file.
   */
  constructor(helper, objectName, configFilePath) {
    this.helper = helper;

    // load config
    this.config = JSON.parse(fs.readFileSync(configFilePath));
    if (!this.config.enabled) return;
    this.objectName = objectName;

    // input sanitization
    for (const attr of ['initialPosition', 'display', 'FSM']) {
      if (!(attr in this.config)) {
        console.error(`missing attribute '${attr}' in ${configFilePath}`);
        return;
      }
    }

    if (!initialPositionValidation(this.config.initialPosition)) return;
    if (!fsmValidation(this.config.FSM)) return;
    if (!displayValidation(this.config.display)) return;

    // kwargs in FSM may be edited, e.g. Bulletin
    this.editedFSM = this.config.FSM

    // Stores the state of every player.
    // TODO: store the states in database (or in `/run/small_data`)
    this.dataStore = new Map(); // key: playerID, value: currentState

    // To ensure that a player can have only one fsmWalk() activated simultaneously.
    this._fsmWalkLock = new Set();

    // Stores whether the while loop in fsmWalk should exit.
    this._fsmWalkExit = new Map(); // key: playerID, value: true|false
  }

  /**
   * TODO
   * @param {String} playerID - TODO
   */
  async fsmWalk(playerID) {
    if (this._fsmWalkLock.has(playerID)) {
      console.warn(`Player '${playerID}' tries to interact '${this.objectName}', but the lock is still there.`);
      return;
    }
    this._fsmWalkLock.add(playerID);

    try { // for release the lock
      const fsm = this.editedFSM; // alias

      // initialize if not exist
      if (!this.dataStore.has(playerID)) this.dataStore.set(playerID, fsm.initialState);

      this._fsmWalkExit.set(playerID, false);
      while (!this._fsmWalkExit.get(playerID)) {
        const currStateStr = this.dataStore.get(playerID);
        const currState = fsm.states[currStateStr];
        if (typeof currState === 'undefined') {
          this.dataStore.set(playerID, fsm.initialState);
          console.warn(`'${currStateStr}' is not a valid state when walking FSM for ${playerID} in ${this.objectName}. Setting it to ${fsm.initialState}`);
          break;
        }

        const kwargs = currState.kwargs;
        const func = 'sf_' + currState.func; // 'sf_' stands for state function
        if (!(func in this)) {
          console.error(`'${func}' is not a valid state function when walking FSM for ${playerID} in ${this.objectName}.`);
          this.dataStore.set(playerID, fsm.initialState);
          break;
        }
        let nextState = '';
        try {
          nextState = await this[func](playerID, kwargs);
        } catch (e) {
          console.error(`Error on calling '${func}' with argument '${playerID}' and ${kwargs}.`);
          console.error(e.stack);
          nextState = this.sf_exit(playerID, {next: currStateStr});
        }

        if (typeof fsm.states[nextState] === 'undefined') {
          console.warn(`Invalid state ${nextState} returned by ${currState.func} when walking FSM for ${playerID} in ${this.objectName}.`);
        }
        this.dataStore.set(playerID, nextState);
      }
    } finally { // for release the lock
      this._fsmWalkLock.delete(playerID);
    }
  }

  /**
   * TODO
   * @return {Array}
   */
  getDisplayInfo() {
    return this.config.display;
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @return {Array}
   */
  async c2s_getDisplayInfo(player) {
    return this.getDisplayInfo();
  }

  /**
   * TODO
   * @return {MapCoord}
   */
  getInitialPosition() {
    return MapCoord.fromObject(this.config.initialPosition);
  }

  /**
   * TODO
   * @param {Object} player - TODO
   * @return {MapCoord}
   */
  async c2s_getInitialPosition(player) {
    return this.getInitialPosition();
  }

  /**
   * TODO
   * @param {String} playerID - TODO
   */
  async startInteraction(playerID) {
    // TODO: check whether the player can interact with this object (e.g. too far to interact)
    console.log(`[NPC] Player '${playerID}' interacts with NPC '${this.objectName}'`);
    // not using await so as to prevent timeout in the client side
    this.fsmWalk(playerID);
  }

  /**
   * TODO
   * @param {Object} player - TODO
   */
  async c2s_startInteraction(player) {
    // not using await so as to prevent timeout in the client side
    this.startInteraction(player.playerID);
  }

  /**
   * Show an overlay in client browser.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_showDialog(playerID, kwargs) {
    function randomChoice(arr) {
      const min = 0;
      const max = arr.length;
      const index = Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
      return arr[index];
    }

    const {dialogs, options} = kwargs;

    // prepare dialog
    let d = '';
    if (typeof dialogs === 'string') d = dialogs;
    if (Array.isArray(dialogs)) d = randomChoice(dialogs);

    // prepare choice
    const c = [];
    for (const [message, nextState] of Object.entries(options)) {
      c.push({token: nextState, display: message});
    }

    const result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000, this.objectName, d, c);
    if (result.token) return result.token;
    console.warn(`Player '${playerID}' does not choose in 'showDialogWithMultichoice'. Result: ${JSON.stringify(result)}`);

    // If we reach here, the showDialog timeouts.
    return this.sf_exit(playerID, {next: this.dataStore.get(playerID)});
  }

  async sf_showDialogAndCheckKey(playerID, kwargs) {
    const {nextState, nextStateIncorrect, dialog, key} = kwargs;
    const res = await this.helper.callS2cAPI(playerID, 'dialog',
    'showDialogWithPrompt', 60*1000, this.objectName, dialog);
    if (res.msg === key) return nextState;

    //The key is wrong,
    return nextStateIncorrect;
  }

  async sf_teleport(playerID, kwargs) {
    const {mapCoord, nextState} = kwargs;
    const result = await this.helper.teleport(playerID, mapCoord);

    if (result) return nextState;
    console.warn(`Player '${playerID}' cannot go to the place`);

    return this.sf_exit(playerID, {next: this.dataStore.get(playerID)});
  }

  /**
   * Check permission by JWT token and go to corresponding state
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_checkPermission(playerID, kwargs) {
    const permission = await this.helper.getToken(playerID);
    const {options} = kwargs;
    for (const [identity, nextState] of Object.entries(options)) {
      if (permission.scope.includes(identity)) {
        return nextState;
      }
    }
    // No identity match
    throw 'No identity match';
  }

  /**
   * Show an input prompt for user to edit the content of dialog.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_editDialog(playerID, kwargs) {
    const {dialogs, buttonText, nextState} = kwargs;

    // prepare dialog
    let d = '';
    if (typeof dialogs === 'string') d = dialogs;
    if (Array.isArray(dialogs)) d = randomChoice(dialogs);

    const result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithPrompt', 60*1000, this.objectName, d, buttonText);
    console.log(result);
    if (result.msg) {
      this.editedFSM.states[nextState].kwargs.dialogs = result.msg;
      return nextState;
    }
    console.warn(`Player '${playerID}' does not choose in 'showDialogWithMultichoice'. Result: ${JSON.stringify(result)}`);

    // If we reach here, the editDialog timeouts.
    return this.sf_exit(playerID, {next: this.dataStore.get(playerID)});
  }

  /**
   * Just a placeholder function to provide `exit` function in configuration.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_exit(playerID, kwargs) {
    this._fsmWalkExit.set(playerID, true);
    if (kwargs && kwargs.next) return kwargs.next;
    return this.config.FSM.initialState;
  }
}

export default InteractiveObjectServerBaseClass;

class Example extends InteractiveObjectServerBaseClass {
  constructor(helper) {
    super(helper, 'exampleConfigPath');
  }

  async c2s_getDisplay(player) {
    return super.getDisplayInfo();
  }

  async c2s_startInteraction(player) {
    // not using await so as to prevent timeout in the client side
    super.startInteraction(player);
  }

  /**
   * `sf_` stands for state function.
   * We can use `customStateFunction1` inside the config file as follows:
   * 'FSM': {
   *   'initialState': 's1',
   *   'states': {
   *     's1': {
   *       'func': 'customStateFunction1',
   *       'kwargs': {},
   *     },
   *   }
   * }
   */
  async sf_customStateFunction1(playerID, kwargs) {
    // maybe call some s2c function
    // return next state
  }
}
