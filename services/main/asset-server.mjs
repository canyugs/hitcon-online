// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting the __dirname.
import url from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

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
   * @param {ExtensionManager} extMan - An extension manager.
   */
  constructor(app, extMan) {
    this.app = app;
    this.extMan = extMan;
  }

  /**
   * Initialize and start the asset server.
   */
  async initialize() {
    this.staticRoutes();
    await this.clientRoutes();
    this.extRoutes();
  }

  /**
   * Prepare the static routes.
   */
  async staticRoutes() {
    // TODO: Restrict the visible pages.
    // Not sure if all static files are in sites
    this.app.use('/static/sites', express.static(__dirname + '/../../sites/'));
    this.app.use('/static/common', express.static(__dirname + '/../../common/'));
    this.app.use('/static/run/map', express.static(__dirname + '/../../run/map'));
    const allExtensionNames = await fs.promises.readdir(__dirname + '/../../extensions');
    for (let extensionName of allExtensionNames) {
      this.app.use(`/static/extensions/${extensionName}`, express.static(__dirname + `/../../extensions/${extensionName}/common`));
    }
  }

  /**
   * Prepare the route for serving the client.
   */
  async clientRoutes() {
    // We're using ejs;
    this.app.set('view engine', 'ejs');

    // Send the user to the game client page.
    this.app.get('/', (req, res) => {
      res.redirect('/client.html');
    });

    // Prepare the client params beforehand.
    this.clientParams = {};
    let partials = await this.extMan.collectPartials(this.extMan.listExtensions());
    this.clientParams.inDiv = [];
    if (typeof partials.inDiv == 'object') {
      this.clientParams.inDiv = partials.inDiv;
    }
    this.app.get('/client.html', (req, res) => {
      res.render(path.resolve(__dirname + '/../../sites/game-client/client.ejs'), this.clientParams);
    });
  }

  /**
   * Prepare the routes for extensions.
   */
  extRoutes() {
    this.app.get('/list_extensions', (req, res) => {
      res.json(this.extMan.listExtensions());
    });
  }

  run() {
  }
}

export default AssetServer;
