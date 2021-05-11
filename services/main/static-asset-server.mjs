// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting the __dirname.
import {dirname} from 'path';
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
    this.app.use('/static', express.static(__dirname+'/../../'));
    // Send the user to the game client page.
    this.app.get('/', function(req, res) {
      res.redirect('/static/sites/game-client/client.html');
    });
  }
}

export default StaticAssetServer;
