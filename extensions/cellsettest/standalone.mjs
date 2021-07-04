// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';


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
    this.set = false;
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
  }

  /**
   * Returns true if this extension have a standalone part.
   * If this returns false, the constructor for Standalone will not be called.
   * Otherwise, a Standalone object is instanciated.
   * @return {Boolean} haveStandalone - See above.
   */
  static haveStandalone() {
    return false;
  }

  changeCellSet(){
    if(!this.set){
      this.helper.broadcastCellSetUpdateToAllUser({
        type: "set",
        cellSet:{
          "name": "testDynamic",
          "priority": 4,
          "cells": [
              { "x": 1, "y": 1, "h": 18, "w": 18 }
          ],
          "layers": [
              {"ground": "P"},
          ]
        }
      });
    }else{
      this.helper.broadcastCellSetUpdateToAllUser({
        type: "unset",
        name: "testDynamic"
      });
    }
    this.set = !this.set;
  }

  /**
   * Return the ejs partials for the client part of this extension.
   * @return {object} partials - An object, it could have the following:
   * inDiv - A string to the path of ejs partial for the location inDiv.
   */
  static getPartials() {
    return {inDiv: 'in-div.ejs'};
  }
}

export default Standalone;
