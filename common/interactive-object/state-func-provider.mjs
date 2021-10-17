// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * StateFuncProviderBase is the base class that provides the ability to run "sf_" functions.
 */
class StateFuncProviderBase {
  /**
   * Creates StateFuncProvider.
   */
  constructor() {
  }

  /**
   * Return the state function named by fnName.
   * @return {function} stateFunc - undefined if the statefunc is not found.
   */
  getStateFunc(fnName) {
    console.assert(false, "StateFuncProviderBase.getStateFunc() is invoked.");
    return undefined;
  }
};

/**
 * InClassStateFuncProvider calls the state func within the class.
 */
class InClassStateFuncProvider {
  /**
   * Create InClassStateFuncProvider
   */
  constructor(runner) {
    this.runner = runner;
  }

  /**
   * See base class.
   */
  getStateFunc(fnName) {
    const fullFnName = 'sf_' + fnName;
    if (!(fullFnName in this.runner)) {
      return undefined;
    }
    return this.runner[fullFnName].bind(this.runner);
  }
};

/**
 * ExtStateFuncProvider calls state func in other extensions through s2s
 * API.
 */
class ExtStateFuncProvider {
  /**
   * Create ExtStateFuncProvider
   */
  constructor(helper) {
    this.helper = helper;
    this.fnTable = {};
  }

  /**
   * See base class.
   */
  getStateFunc(fnName) {
    if (!(fnName in this.fnTable)) {
      return undefined;
    }
    const fnObj = this.fnTable[fnName];
    return fnObj.fn;
  }

  /**
   * Add an s2s state func.
   * @param {String} fnName - The name of the sf_ function, without "sf_"
   *   prefix.
   * @param {String} extName - The name of the extension.
   * @param {String} methodName - The s2s API name.
   */
  registerStateFunc(fnName, extName, methodName) {
    const fnObj = {};
    fnObj.fn = async (playerID, kwargs, sfInfo) => {
      return await this.helper.callS2sAPI(extName, methodName, playerID, kwargs, sfInfo);
    };
    fnObj.extName = extName;
    fnObj.methodName = methodName;
    if (fnName in this.fnTable) {
      console.warn(`Duplicate registration for ${fnName} in ExtStateFuncProvider`);
    }
    this.fnTable[fnName] = fnObj;
  }
}

/**
 * StackStateFuncProvider allows multiple StateFuncProvider to be used as one.
 */
class StackStateFuncProvider {
  /**
   * Create StackStateFuncProvider
   */
  constructor() {
    this.stack = [];
  }

  /**
   * See base class.
   */
  getStateFunc(fnName) {
    for (let i = 0; i < this.stack.length; i++) {
      const fn = this.stack[i].getStateFunc(fnName);
      if (typeof fn !== 'undefined') {
        return fn;
      }
    }
    return undefined;
  }

  /**
   * Add a StateFuncProvider.
   */
  addProvider(p) {
    this.stack.push(p);
  }
}

export {StateFuncProviderBase, InClassStateFuncProvider, ExtStateFuncProvider, StackStateFuncProvider};
