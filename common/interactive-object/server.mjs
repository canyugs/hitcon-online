// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';

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

class InteractiveObjectServerBaseClass {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   * @param {String} configFilePath - The path of the config file.
   */
  constructor(helper, configFilePath) {
    this.helper = helper;

    // load config
    this.config = JSON.parse(fs.readFileSync(configFilePath));
    if (!this.config.enabled) return;

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

    // TODO: store the states in database (or in `/run/small_data`)
    this.dataStore = new Map(); // key: playerName, value: currentState
  }

  /**
   * TODO
   * @param {Object} player - TODO
   */
  async fsmWalk(player) {
    const playerID = player;
    const fsm = this.config.FSM; // alias

    // initialize if not exist
    if (!this.dataStore.has(playerID)) this.dataStore.set(playerID, fsm.initialState);

    this._fsmWalkExit = false;
    while (!this._fsmWalkExit) {
      const currState = fsm.states[this.dataStore.get(playerID)];
      if (typeof currState === 'undefined') {
        this.dataStore.set(playerID, fsm.initialState);
        break;
      }

      const kwargs = currState.kwargs;
      const func = 'sf_' + currState.func; // 'sf_' stands for state function
      if (!(func in this)) {
        console.error(`'${func}' is not a valid state function`);
        this.dataStore.set(playerID, fsm.initialState);
        break;
      }
      const nextState = await this[func](kwargs);
      this.dataStore.set(playerID, nextState);
    }
  }

  /**
   * TODO
   * @return {Object}
   */
  getDisplayInfo() {
    return this.config.display;
  }

  /**
   * TODO
   * @param {Object} player - TODO
   */
  async startInteraction(player) {
    // not using await so as to prevent timeout in the client side
    this.fsmWalk(player);
  }

  /**
   * Show an overlay in client browser.
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_showDialog(kwargs) {
    // TODO
    const {dialogs, options} = kwargs;
    return Object.values(options)[0];
  }

  /**
   * Just a placeholder function to provide `exit` function in configuration.
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_exit(kwargs) {
    this._fsmWalkExit = true;
    return kwargs.next;
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
  async sf_customStateFunction1(kwargs) {
    // maybe call some s2c function
    // return next state
  }
}
