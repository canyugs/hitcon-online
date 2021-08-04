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
import SingleProcessRPCDirectory from
  '../../common/rpc-directory/single-process-RPC-directory.mjs';
import AssetServer from '../assets/asset-server.mjs';
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

  /* Check if main-server should be used & warn the developer of the special (and possibly unexpected) behavior. */
  if(config.get('multiprocess')) {
    console.error("The main-server.mjs should only be used in single-process mode.");
    return;
  }
  if(Object.keys(config.get('assetServers')).length > 1) {
    console.warn("The main-server.mjs would use the first asset server in the config file. Use multiprocessing mode to create all asset servers.");
  }
  if(Object.keys(config.get('gatewayServers')).length > 1) {
    console.warn("The main-server.mjs would use the first gateway service in the config file. Use multiprocessing mode to create all gateway servers.");
  }

  /* Create all utility classes */
  const rpcDirectory = new SingleProcessRPCDirectory();
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
  const extensionManager = new ExtensionManager(rpcDirectory, broadcaster, gameMap, gameState);
  const gatewayService = new GatewayService(rpcDirectory, gameMap, authServer,
    broadcaster, io, extensionManager);
  const assetServer = new AssetServer(app, extensionManager, null);
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
  await gatewayService.initialize(Object.keys(config.get('gatewayServers'))[0]);
  authServer.run();
  for (const extName of extensionManager.listExtensions()) {
    await extensionManager.startExtensionService(extName);
  }

  gatewayService.addServer(io);

  // TODO: Set the port once configuration is done.
  const port = config.get('assetServers')[Object.keys(config.get('assetServers'))[0]].port;
  console.log(`Server is listening on port ${port} ...`);
  server.listen(port);
}

mainServer();
