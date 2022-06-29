// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting the __dirname.
import url from 'url';
import path from 'path';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const express = require('express');

import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

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
  constructor(app, extMan, gatewayAddresses) {
    this.app = app;
    this.extMan = extMan;
    this.gatewayAddresses = gatewayAddresses;
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
    this.app.use('/static/sites', express.static(path.resolve(__dirname, '../../sites/')));
    this.app.use('/static/common', express.static(path.resolve(__dirname, '../../common/')));
    this.app.use('/static/run/map', express.static(getRunPath('map')));
    this.app.use('/static/run/hosted', express.static(getRunPath('hosted')));
    for (const extName of this.extMan.listExtensions()) {
      this.app.use(`/static/extensions/${extName}/common`,
        express.static(path.resolve(__dirname, `../../extensions/${extName}/common`)));
    }
  }

  /**
   * Return the path for assets in game-client directory.
   */
  _getGameClientPath(p) {
    return path.resolve(__dirname, '../../sites/game-client/'+p);
  }

  /**
   * Helper for creating client parameters.
   * @param {string} clientType - 'desktop' or 'mobile'
   */
  async _createClientParams(clientType) {
    console.assert(clientType === 'desktop' || clientType === 'mobile',
                   'clientType must be desktop or mobile in _createClientParams');
    const result = {};
    result.inDiv = []

    let partials = await this.extMan.collectPartials(this.extMan.listExtensions(), clientType);
    result.inDiv = [];
    if (typeof partials.inDiv == 'object') {
      result.inDiv = partials.inDiv;
    }
    result.headerContent = this._getGameClientPath(`header-${clientType}.ejs`);
    result.bodyContent = this._getGameClientPath(`body-${clientType}.ejs`);
    result.clientType = clientType;
    return result;
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
    this.clientParamsDesktop = await this._createClientParams('desktop');
    this.clientParamsMobile = await this._createClientParams('mobile');

    this.app.get('/client.html', (req, res) => {
      // TODO: workaround for development, in production we should fetch the unique endpoint from the config.
      const clientParams = JSON.parse(JSON.stringify(this.clientParamsDesktop));
      clientParams.gatewayAddress = this.gatewayAddresses ? this.gatewayAddresses[Math.floor(Math.random() * this.gatewayAddresses.length)] : null;
      res.render(this._getGameClientPath('client.ejs'), clientParams);
    });
    this.app.get('/mobile.html', (req, res) => {
      const clientParams = JSON.parse(JSON.stringify(this.clientParamsMobile));
      clientParams.gatewayAddress = this.gatewayAddresses ? this.gatewayAddresses[Math.floor(Math.random() * this.gatewayAddresses.length)] : null;
      res.render(this._getGameClientPath('client.ejs'), clientParams);
    });

    this.app.get('/health', (req, res) => {
      res.status(200).send('OK');
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
