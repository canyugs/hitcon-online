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
import GraphicAsset from '../../common/maplib/graphic-asset.mjs';
import GameState from '../../common/gamelib/game-state.mjs';
import ExtensionManager from '../../common/extlib/extension-manager.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

async function mainServer() {
  console.log('Running from: ', getRunPath());

  /* Create the http service */
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  /* Check if main-server should be used & warn the developer of the special (and possibly unexpected) behavior. */
  if (config.get('multiprocess')) {
    console.error("The main-server.mjs should only be used in single-process mode.");
    return;
  }
  if (Object.keys(config.get('gatewayServers')).length > 1) {
    console.warn("The main-server.mjs would use the first gateway service in the config file. Use multiprocessing mode to create all gateway servers.");
  }

  /* Create all utility classes */
  const rpcDirectory = new SingleProcessRPCDirectory();
  await rpcDirectory.asyncConstruct();
  // Load the map.
  const mapList = config.get("map");
  const rawMapJSON = fs.readFileSync(getRunPath(mapList[0]));
  const rawAssetJSON = fs.readFileSync(getRunPath('map', 'assets.json'));
  const mapJSON = JSON.parse(rawMapJSON);
  const assetJSON = JSON.parse(rawAssetJSON);
  // We do not load the graphic asset on the server side.
  const graphicAsset = new GraphicAsset(assetJSON);
  const gameMap = new GameMap(graphicAsset, mapJSON);
  const gameState = new GameState(gameMap);

  /* Create all services */
  const authServer = new AuthServer(app);
  const broadcaster = new AllAreaBroadcaster(rpcDirectory, gameMap, gameState);
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
  const port = config.get('assetServer.port');
  console.log(`Server is listening on port ${port} ...`);
  server.listen(port);
}

mainServer();
