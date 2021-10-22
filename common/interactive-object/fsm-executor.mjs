// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {InClassStateFuncProvider, ExtStateFuncProvider, StackStateFuncProvider} from './state-func-provider.mjs';

const FSM_ERROR = '__fsm_error';

/**
 * FSM executor runs finite state machine.
 */
class FSMExecutor {
  /**
   * Create FSMExecutor
   */
  constructor(helper, fsm, executorName) {
    this.helper = helper;
    this.fsm = fsm;
    this.executorName = executorName;

    // Stores the state of every player.
    // TODO: store the states in database (or in `/run/small_data`)
    this.dataStore = new Map(); // key: playerID, value: currentState

    // To ensure that a player can have only one fsmWalk() activated simultaneously.
    this._fsmWalkLock = new Set();

    // Stores whether the while loop in fsmWalk should exit.
    this._fsmWalkExit = new Map(); // key: playerID, value: true|false

    // Initialize the state function providers, so that we can access state functions from both
    // internally and externally.
    this.stateFuncProvider = new StackStateFuncProvider();
    this.stateFuncProviderInClass = new InClassStateFuncProvider(this);
    this.stateFuncProvider.addProvider(this.stateFuncProviderInClass);
    this.stateFuncProviderExt = new ExtStateFuncProvider(helper);
    this.stateFuncProvider.addProvider(this.stateFuncProviderExt);

    // Update the infoForStateFunc.
    this._updateInfoForStateFunc();
  }

  /**
   * Register an s2s func as a state func.
   * The s2s API should have the following signature:
   * (srcExt, playerID, kwargs, sfInfo)
   * @param {String} fnName - The state function name.
   * @param {String} extName - The s2s ext name.
   * @param {String} methodName - The s2s method name.
   */
  registerExtStateFunc(fnName, extName, methodName) {
    this.stateFuncProviderExt.registerStateFunc(fnName, extName, methodName);
  }

  /**
   * Update the internal infoForStateFunc, an object passed to
   * state function for their information.
   */
  _updateInfoForStateFunc() {
    this.infoForStateFunc = {};
    this.infoForStateFunc.objectName = this.objectName;
  }

  /**
   * TODO
   * @param {String} playerID - TODO
   */
  async fsmWalk(playerID) {
    if (this._fsmWalkLock.has(playerID)) {
      console.warn(`Player '${playerID}' tries to interact '${this.executorName}', but the lock is still there.`);
      return;
    }
    this._fsmWalkLock.add(playerID);

    try { // for release the lock
      const fsm = this.fsm; // alias

      // initialize if not exist
      if (!this.dataStore.has(playerID)) this.dataStore.set(playerID, fsm.initialState);

      this._fsmWalkExit.set(playerID, false);
      while (!this._fsmWalkExit.get(playerID)) {
        const currStateStr = this.dataStore.get(playerID);
        const currState = fsm.states[currStateStr];
        if (typeof currState === 'undefined') {
          this.dataStore.set(playerID, fsm.initialState);
          console.warn(`'${currStateStr}' is not a valid state when walking FSM for ${playerID} in ${this.executorName}. Setting it to ${fsm.initialState}`);
          break;
        }

        const kwargs = currState.kwargs;
        const func = this.stateFuncProvider.getStateFunc(currState.func);
        if (!func) {
          console.error(`'${func}' is not a valid state function when walking FSM for ${playerID} in ${this.executorName}.`);
          this.dataStore.set(playerID, fsm.initialState);
          break;
        }
        let nextState = '';
        try {
          nextState = await func(playerID, kwargs, this.infoForStateFunc);
          if (typeof nextState !== 'string') {
            console.error('Invalid nextState returned', nextState);
            throw 'Invalid nextState returned';
          }
        } catch (e) {
          console.error(`Error on calling '${currState.func}', aka '${func}' with argument: `, playerID, kwargs);
          console.error(e.stack);
          nextState = await this.sf_exit(playerID, {next: currStateStr});
        }
        // Handle special error state.
        if (nextState === FSM_ERROR) {
          nextState = await this.sf_exit(playerID, {next: this.dataStore.get(playerID)});
        }

        if (typeof fsm.states[nextState] === 'undefined') {
          console.warn(`Invalid state ${nextState} returned by ${currState.func} when walking FSM for ${playerID} in ${this.executorName}.`);
        }
        this.dataStore.set(playerID, nextState);
      }
    } finally { // for release the lock
      this._fsmWalkLock.delete(playerID);
    }
  }

  /**
   * Just a placeholder function to provide `exit` function in configuration.
   * @param {String} playerID
   * @param {Object} kwargs - TODO
   * @return {String} - the next state
   */
  async sf_exit(playerID, kwargs, sfInfo) {
    this._fsmWalkExit.set(playerID, true);
    if (kwargs && kwargs.next) return kwargs.next;
    return this.config.FSM.initialState;
  }
}

FSMExecutor.FSM_ERROR = FSM_ERROR;

export default FSMExecutor;
