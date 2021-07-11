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

/* Import all servers */
import GatewayService from '../gateway/gateway-service.mjs';
import AllAreaBroadcaster from '../gateway/all-area-broadcaster.mjs';
import Directory from '../../common/rpc-directory/directory.mjs';
import SingleProcessRPCDirectory from
  '../../common/rpc-directory/single-process-RPC-directory.mjs';
import MultiProcessRPCDirectory from
  '../../common/rpc-directory/multi-process-RPC-directory.mjs';
import AssetServer from './asset-server.mjs';
import AuthServer from '../auth/AuthServer.mjs';

/* Import all utility classes */
import GameMap from '../../common/maplib/map.mjs';
import GameState from '../../common/maplib/game-state.mjs';
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
  const io = new Server(server);

  /* Create all utility classes */
  //const rpcDirectory = new SingleProcessRPCDirectory();
  const rpcDirectory = new MultiProcessRPCDirectory();
  await rpcDirectory.asyncConstruct();
  // Load the map.
  const mapList = config.get("map");
  const rawMapJSON = fs.readFileSync(mapList[0]);
  const mapJSON = JSON.parse(rawMapJSON);
  // We do not have GraphicAsset on the server side.
  const gameMap = new GameMap(undefined, mapJSON);
  const gameState = new GameState(gameMap);

  /* Create all services */
  const authServer = new AuthServer(app);
  const broadcaster = new AllAreaBroadcaster(rpcDirectory, gameMap);
  const extensionManager = new ExtensionManager(rpcDirectory, broadcaster);
  const gatewayService = new GatewayService(rpcDirectory, gameMap, authServer,
    broadcaster, io, extensionManager);
  const assetServer = new AssetServer(app, extensionManager);
  await extensionManager.ensureClass('blank');
  for (const extName of extensionManager.listExtensions()) {
    await extensionManager.createExtensionService(extName);
  }

  /* Initialize static asset server */
  await assetServer.initialize();
  /* Start static asset server */
  assetServer.run();

  /* Initialize broadcaster and gateway service */
  await broadcaster.initialize();
  await gatewayService.initialize(('gateway-service' in argv) ? argv['gateway-service'] : "gatewayServer");
  authServer.run();
  for (const extName of extensionManager.listExtensions()) {
    await extensionManager.startExtensionService(extName);
  }

  gatewayService.addServer(io);

  // TODO: Set the port once configuration is done.
  console.log(`Server is listening on port ${config.get('server.port')} ...`);
  server.listen(config.get('server.port'));
}

mainServer();
