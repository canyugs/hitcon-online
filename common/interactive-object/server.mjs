// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import fs from 'fs';
import {MapCoord} from '../maplib/map.mjs';
import {randomShuffle, randomChoice} from '../utility/random-tool.mjs';
import {InClassStateFuncProvider, ExtStateFuncProvider, StackStateFuncProvider} from './state-func-provider.mjs';
import FSMExecutor from './fsm-executor.mjs';

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
  static IOBJ_PREFIX = "iobj-"
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
    this.visibleName = objectName;
    if (typeof this.config.visibleName === 'string') {
      this.visibleName = this.config.visibleName;
    }
    this.distanceLimit = this.config.distanceLimit;
    if (!Number.isInteger(this.distanceLimit)) {
      // Set to undefined to disable distance limit.
      if (typeof this.distanceLimit !== 'undefined' && this.distanceLimit !== null) {
        console.warn(`${this.objectName} have invalid distance limit: `, this.distanceLimit);
      }
      this.distanceLimit = undefined;
    }
    this.interactType = this.config.interactType;
    if (this.interactType !== 'click' && this.interactType !== 'loc') {
      this.interactType = 'click';
    }

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

    // Create the executor
    const sfInfo = {
      name: `${InteractiveObjectServerBaseClass.IOBJ_PREFIX}${this.objectName}`,
      visibleName: `${this.visibleName}`
    };
    this.fsmExecutor = new FSMExecutor(this.helper, this.config.FSM, sfInfo);

    // Update the clientInfo.
    this._updateClientInfoCache();
  }

  /**
   * See FSMExecutor.registerExtStateFuncOne.
   */
  registerExtStateFuncOne(extName, fnName) {
    this.fsmExecutor.registerExtStateFuncOne(extName, fnName);
  }

  /**
   * See FSMExecutor.registerExtStateFuncAll.
   */
  registerExtStateFuncAll(extName, fnNames) {
    this.fsmExecutor.registerExtStateFuncAll(extName, fnNames);
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
    this.clientInfo.visibleName = this.visibleName;
    this.clientInfo.objectName = this.objectName;
    this.clientInfo.distanceLimit = this.distanceLimit;
    this.clientInfo.interactType = this.interactType;
  }

  /**
   * Return the information needed by the client side for this interactive object.
   */
  getClientInfo() {
    return this.clientInfo;
  }

  /**
   * Return the interactive object's MapCoord.
   */
  getPosition() {
    // Interactive objects can't move, for now.
    return this.getInitialPosition();
  }

  /**
   * TODO
   * @param {String} playerID - TODO
   */
  async startInteraction(playerID) {
    // TODO: check whether the player can interact with this object (e.g. too far to interact)
    const loc = await this.helper.getPlayerLocation(playerID);
    if (typeof loc === 'undefined') {
      console.warn(`Player ${playerID} is nowhere to be found when trying to interact with ${this.objectName}`);
      return false;
    }
    if (Number.isInteger(this.distanceLimit) && loc.distanceTo1(this.getPosition()) > this.distanceLimit) {
      console.warn(`Player ${playerID} is interacting with ${this.objectName} from too far away`);
      return false;
    }

    console.log(`[NPC] Player '${playerID}' interacts with NPC '${this.objectName}'`);
    // not using await so as to prevent timeout in the client side
    this.fsmExecutor.fsmWalk(playerID);
  }
}

// Set it as part of the class so other classes can access it.
InteractiveObjectServerBaseClass.FSM_ERROR = FSMExecutor.FSM_ERROR;

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
