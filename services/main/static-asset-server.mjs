// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting the __dirname.
import {dirname,resolve} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const express = require('express');

/**
 * Static asset server serves static assets.
 */
class StaticAssetServer {
  /**
   * Create a static asset server, but doesn't start it.
   * @constructor
   * @param {App} app - An express app or router compatible with express.js.
   */
  constructor(app) {
    this.app = app;
  }

  /**
   * Initialize and start the static asset server.
   */
  initialize() {
    // TODO: Restrict the visible pages.
    // Not sure if all static files are in sites
    this.app.use('/static/sites', express.static(__dirname + '/../../sites/'));
    this.app.use('/static/common', express.static(__dirname + '/../../common/'));
    this.app.use('/static/run/map', express.static(__dirname + '/../../run/map'));
  }

  run() {
    // Send the user to the game client page.
    this.app.get('/', (req, res) => {
      res.redirect('/static/sites/game-client/client.html');
    });
  }
}

export default StaticAssetServer;
