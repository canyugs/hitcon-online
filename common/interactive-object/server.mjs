// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import {MapCoord} from '../maplib/map.mjs';
import {randomShuffle, randomChoice} from '../utility/random-tool.mjs';
import {InClassStateFuncProvider, ExtStateFuncProvider, StackStateFuncProvider} from './state-func-provider.mjs';

const FSM_ERROR = '__fsm_error';

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
    this.problemSet = JSON.parse(fs.readFileSync('items/problems.json'));

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

    // Update the clientInfo.
    this._updateClientInfoCache();

    // Stores the editable dialog variables
    this.dialogVars = {};

    // Stores the state of every player.
    // TODO: store the states in database (or in `/run/small_data`)
    this.dataStore = new Map(); // key: playerID, value: currentState

    // To ensure that a player can have only one fsmWalk() activated simultaneously.
    this._fsmWalkLock = new Set();

    // Stores whether the while loop in fsmWalk should exit.
    this._fsmWalkExit = new Map(); // key: playerID, value: true|false

    // Set it as a const member so other users can access it more easily.
    this.FSM_ERROR = FSM_ERROR;

    // Initialize the state function providers, so that we can access state functions from both
    // internally and externally.
    this.stateFuncProvider = new StackStateFuncProvider();
    this.stateFuncProviderInClass = new InClassStateFuncProvider(this);
    this.stateFuncProvider.addProvider(this.stateFuncProviderInClass);
    this.stateFuncProviderExt = new ExtStateFuncProvider(helper);
    this.stateFuncProvider.addProvider(this.stateFuncProviderExt);
  }

  /**
   * Register an s2s func as a state func.
   * The s2s API should have the following signature:
   * (srcExt, playerID, kwargs)
   * @param {String} fnName - The state function name.
   * @param {String} extName - The s2s ext name.
   * @param {String} methodName - The s2s method name.
   */
  registerExtStateFunc(fnName, extName, methodName) {
    this.stateFuncProviderExt.registerStateFunc(fnName, extName, methodName);
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
      const fsm = this.config.FSM; // alias

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
        const func = this.stateFuncProvider.getStateFunc(currState.func);
        if (!func) {
          console.error(`'${func}' is not a valid state function when walking FSM for ${playerID} in ${this.objectName}.`);
          this.dataStore.set(playerID, fsm.initialState);
          break;
        }
        let nextState = '';
        try {
          nextState = await func(playerID, kwargs);
        } catch (e) {
          console.error(`Error on calling '${func}' with argument '${playerID}' and ${kwargs}.`);
          console.error(e.stack);
          nextState = this.sf_exit(playerID, {next: currStateStr});
        }
        // Handle special error state.
        if (nextState === this.FSM_ERROR) {
          nextState = this.sf_exit(playerID, {next: this.dataStore.get(playerID)});
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
  getDisplayConfig() {
    return this.config.display;
  }

  /**
   * TODO
   * @return {MapCoord}
   */
  getInitialPosition() {
    return MapCoord.fromObject(this.config.initialPosition);
  }

  _updateClientInfoCache() {
    this.clientInfo = {};
    this.clientInfo.initialPosition = this.getInitialPosition();
    this.clientInfo.displayConfig = this.getDisplayConfig();
  }

  /**
   * Return the information needed by the client side for this interactive object.
   */
  getClientInfo() {
    return this.clientInfo;
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

    const result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000, this.objectName, d, c);
    if (result.token) return result.token;
    console.warn(`Player '${playerID}' does not choose in 'showDialogWithMultichoice'. Result: ${JSON.stringify(result)}`);

    // If we reach here, the showDialog timeouts.
    return this.FSM_ERROR;
  }

  async sf_showDialogAndCheckKey(playerID, kwargs) {
    const {nextState, nextStateIncorrect, dialog, key} = kwargs;
    const res = await this.helper.callS2cAPI(playerID, 'dialog',
    'showDialogWithPrompt', 60*1000, this.objectName, dialog);
    if (res.msg === key) return nextState;

    //The key is wrong,
    return nextStateIncorrect;
  }

  async sf_answerProblems(playerID, kwargs) {
    const {problems, goalPoints, nextState, nextStateIncorrect} = kwargs;
    randomShuffle(this.problemSet);
    let result, correct = 0, d = '';
    for (let i = 0; i < problems; i++) {
      const c = [];
      d = this.problemSet[i].dialogs;
      for (const option of this.problemSet[i].options) {
        c.push({token: option[0], display: option});
      }
      result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithMultichoice', 60*1000, this.objectName, d, c);
      if (!result.token) {
        console.warn(`Player '${playerID}' does not choose in 'answerProblems'. Result: ${JSON.stringify(result)}`);
        return this.FSM_ERROR;
      } else if (result.token === this.problemSet[i].ans) correct += 1;
    }
    if (correct >= goalPoints) return nextState;
    return nextStateIncorrect;
  }

  async sf_teleport(playerID, kwargs) {
    const {mapCoord, nextState} = kwargs;
    const result = await this.helper.teleport(playerID, mapCoord);

    if (result) return nextState;
    console.warn(`Player '${playerID}' cannot go to the place`);

    return this.FSM_ERROR;
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
      if (permission.scp.includes(identity)) {
        return nextState;
      }
    }
    // No identity match and return default next state
    return options['default'];
  }

  /**
   * Show an input prompt for user to edit the content of dialog.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_editDialog(playerID, kwargs) {
    const {dialogs, dialogVar, buttonText, nextState} = kwargs;

    // prepare dialog
    let d = '';
    if (typeof dialogs === 'string') d = dialogs;
    if (Array.isArray(dialogs)) d = randomChoice(dialogs);

    const result = await this.helper.callS2cAPI(playerID, 'dialog', 'showDialogWithPrompt', 60*1000, this.objectName, d, buttonText);
    if (result.msg) {
      if (typeof dialogVar === 'string') {
        this.dialogVars[dialogVar] = result.msg;
      }
      return nextState;
    }
    console.warn(`Player '${playerID}' does not choose in 'showDialogWithMultichoice'. Result: ${JSON.stringify(result)}`);

    // If we reach here, the editDialog timeouts.
    return this.FSM_ERROR;
  }

  /**
   * Give the player an amount of items.
   * @param {String} playerID
   * @param {Object} kwargs - kwargs.amount specifies the amount of items to give.
   *   kwargs.maxAmount specifies the maximum amount of this item the user should have. The user will be given up to kwargs.amount items until the user have kwargs.maxAmount.
   *   kwargs.itemName - The item to give.
   *   kwargs.next - The next state.
   * @return {String} nextState - The next state.
   */
  async sf_giveItem(playerID, kwargs) {
    let amount = kwargs.amount;
    let maxAmount = kwargs.maxAmount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;
    if (!Number.isInteger(maxAmount) || maxAmount <= 0) maxAmount = -1;

    const result = await this.helper.callS2sAPI('items', 'AddItem', playerID, itemName, amount, maxAmount);
    if (result.ok !== true) {
      console.error('items.AddItem() failed, maybe items ext is not running?');
      return this.FSM_ERROR;
    }
    return kwargs.nextState;
  }

  /**
   * Take amount of items from the player.
   * @param {String} playerID
   * @param {Object} kwargs - kwargs.amount specifies the amount the player should have and the amount to be taken.
   *   kwargs.item specifies which item to check.
   *   kwargs.haveItem specifies the state to go to if the player have the amount of specified items.
   *   kwargs.noItem specifies the state to go to if the player don't have the amount of specified items.
   * @return {String} nextState - The next state.
   */
  async sf_takeItem(playerID, kwargs) {
    let amount = kwargs.amount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;

    result = await this.helper.callS2sAPI('items', 'TakeItem', playerID, itemName, amount);
    if (typeof result.error !== 'undefined' || typeof result.ok !== 'boolean') {
      // Extension not running?
      console.error('items.TakeItem() failed, maybe items ext is not running?');
      return this.FSM_ERROR;
    }

    if (result.ok) {
      return kwargs.haveItem;
    } else {
      return kwargs.noItem;
    }
  }

  /**
   * Count the amount of given item owned by the player.
   * @param {Object} kwargs - kwargs.amount specifies the amount the player should have.
   *   kwargs.item specifies which item to check.
   *   kwargs.haveItem specifies the state to go to if the player have the amount of specified items.
   *   kwargs.noItem specifies the state to go to if the player don't have the amount of specified items.
   * @return {String} nextState - The next state.
   * WARNING: Using this method and takeItem() together may result in time-of-check-to-time-of-use exploit. In that case, please use takeItem() only.
   */
  async sf_haveItem(playerID, kwargs) {
    let amount = kwargs.amount;
    let itemName = kwargs.itemName;

    if (!Number.isInteger(amount)) amount = 1;

    result = await this.helper.callS2sAPI('items', 'CountItem', playerID, itemName);
    if (typeof result.error !== 'undefined' || !Number.isInteger(result.amount)) {
      // Extension not running?
      console.error('items.CountItem() failed, maybe items ext is not running?');
      return this.FSM_ERROR;
    }

    if (result.amount >= amount) {
      return kwargs.haveItem;
    } else {
      return kwargs.noItem;
    }
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
