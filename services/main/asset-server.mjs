// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const express = require('express');
const path = require('path');
const config = require('config');
const redis = require('redis');
const {Server} = require('socket.io');
const http = require('http');
const argv = require('minimist')(process.argv.slice(2));

import fs from 'fs';

import AssetServer from '../assets/asset-server.mjs';
import ExtensionManager from '../../common/extlib/extension-manager.mjs';

async function mainServer() {
  /* Redis integration */
  // TODO: Uncomment once configuration for redis is done.
  // redisClient = redis.createClient();
  // redisClient.on('error', (err) => {
  //   console.error(err);
  // });

  /* Create the http service */
  const app = express();
  const server = http.createServer(app);

  /* Create services */
  const extensionManager = new ExtensionManager(null, null, null, null);
  console.log(Object.values(config.get('gatewayServers')).map(v => v.httpAddress));
  const assetServer = new AssetServer(app, extensionManager, Object.values(config.get('gatewayServers')).map(v => v.httpAddress));

  /* Initialize static asset server */
  await assetServer.initialize();
  /* Start static asset server */
  assetServer.run();

  // TODO: Set the port once configuration is done.
  const serviceName = ('service-name' in argv) ? argv['service-name'] : Object.keys(config.get('assetServers'))[0];
  const port = config.get('assetServers')[serviceName].port;
  console.log(`Server is listening on port ${port} ...`);
  server.listen(port);
}

mainServer();
