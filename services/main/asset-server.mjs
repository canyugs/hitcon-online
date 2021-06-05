// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting the __dirname.
import {dirname,resolve} from 'path';
import {fileURLToPath} from 'url';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const express = require('express');

/**
 * Asset server serves static and dynamic assets.
 */
class AssetServer {
  /**
   * Create an asset server, but doesn't start it.
   * @constructor
   * @param {App} app - An express app or router compatible with express.js.
   */
  constructor(app) {
    this.app = app;
  }

  /**
   * Initialize and start the asset server.
   */
  initialize() {
    this.staticRoutes();
    this.clientRoutes();
  }

  /**
   * Prepare the static routes.
   */
  staticRoutes() {
    // TODO: Restrict the visible pages.
    // Not sure if all static files are in sites
    this.app.use('/static/sites', express.static(__dirname + '/../../sites/'));
    this.app.use('/static/common', express.static(__dirname + '/../../common/'));
    this.app.use('/static/run/map', express.static(__dirname + '/../../run/map'));
  }

  /**
   * Prepare the route for serving the client.
   */
  clientRoutes() {
    // We're using ejs;
    this.app.set('view engine', 'ejs');

    // Send the user to the game client page.
    this.app.get('/', (req, res) => {
      res.redirect('/client.html');
    });
    this.app.get('/client.html', (req, res) => {
      res.render(path.resolve(__dirname + '/../../sites/game-client/client.ejs'));
    });
  }

  run() {
  }
}

export default AssetServer;
