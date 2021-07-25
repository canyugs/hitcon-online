// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * This file defines the interface of a cell set.
 * An example format of a CellSet can be found at the end of the file.
 */

/**
 * A cell set is a set of map coordinates that have some special meaning.
 * Note that a cell set is applied to `_SingleMap` instead of `GameMap`, and
 * therefore a cell set does not have `mapName` property.
 *
 * The greater value of property `priority`, the higher priority the cell set is.
 * If two cell set has the same priority, prefer dynamic cell set over static one.
 */
class CellSet {
  /**
   * @constructor
   * @param {String} name - the name of the cell set
   * @param {Number} priority - an integer; greater value means higher priority
   * @param {Array} cells - a list of object {x, y, w, h}
   * @param {Object} layers - the layers to overwrite
   * @param {Boolean} dynamic - (optional) whether this cell set is dynamic cell set;
   * default to `true`
   */
  constructor(name, priority, cells, layers, dynamic) {
    this.name = name;
    this.priority = priority;
    this.cells = (cells ?? []);
    this.layers = (layers ?? {});
    this.dynamic = (dynamic ?? true);
  }

  /**
   * Check if mapCoord lies inside this cell set.
   * Does not care the mapName of mapCoord.
   * @param {MapCoord} mapCoord - The map coordinate. `mapName` is ignored.
   * @return {Boolean}
   */
  containsMapCoord(mapCoord) {
    return mapCoord.insideCellSet(this);
  }

  /**
   * The serialization used by JSON.stringify().
   * @return {Object}
   */
  toJSON() {
    return {
      name: this.name,
      priority: this.priority,
      cells: this.cells,
      layers: this.layers,
      dynamic: this.dynamic,
    };
  }

  /**
   * Deserialize a JSON object into CellSet.
   * @param {Object} obj - the JSON object
   * @return {CellSet}
   */
  static fromObject(obj) {
    return new CellSet(obj.name, obj.priority, obj.cells, obj.layers, obj.dynamic);
  }
}

export default CellSet;

/**
 * An example format of a CellSet:
 *
 * {
 *   "name": "bombmanObstacles1",
 *   "priority": 2,
 *   "cells": [
 *     { "x": 3, "y": 5, "w": 2, "h": 1 },
 *     { "x": 6, "y": 3, "w": 1, "h": 1 }
 *   ],
 *   "layers": {
 *     "bombmanObstacle": "O",
 *     "wall": true
 *   },
 *   "dynamic": false
 * }
 */
