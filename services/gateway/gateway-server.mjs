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
import GatewayService from './gateway-service.mjs';
import AllAreaBroadcaster from './all-area-broadcaster.mjs';
import SingleProcessRPCDirectory from
  '../../common/rpc-directory/single-process-RPC-directory.mjs';
import MultiProcessRPCDirectory from
  '../../common/rpc-directory/multi-process-RPC-directory.mjs';
import AuthServer from '../auth/AuthServer.mjs';
import AssetServer from '../assets/asset-server.mjs';

/* Import all utility classes */
import GameMap from '../../common/maplib/map.mjs';
import GraphicAsset from '../../common/maplib/graphic-asset.mjs';
import GameState from '../../common/gamelib/game-state.mjs';
import {MovementManagerServer} from '../../common/gamelib/movement-manager.mjs';
import ExtensionManager from '../../common/extlib/extension-manager.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

async function mainServer() {
  const corsValidation = function (origin, callback) {
    // https://github.com/expressjs/cors/issues/71
    if (origin === undefined) {
      callback(null, true);
      return;
    }

    let originHostname;
    try {
      originHostname = (new URL(origin)).hostname;
    } catch {
      console.error("Can't parse URL: ", origin);
      callback(new Error('Not allowed by CORS'));
      return;
    }

    if (!config.get('allowedOrigins')) {
      callback(null, true);
      return;
    }

    // for development only, might need to removed in the future.
    if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
      callback(null, true);
      return;
    }

    if (Array.isArray(config.get('allowedOrigins')) && config.get('allowedOrigins').includes(originHostname)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  };

  /* Create the http service */
  const app = express();

  app.use(require('cors')({
    origin: corsValidation
  }));
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: true,
    origin: corsValidation
  });

  /* Create all utility classes */
  const rpcDirectory = config.get('multiprocess')
                        ? (new MultiProcessRPCDirectory())
                        : (new SingleProcessRPCDirectory());
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
  const movementManager = new MovementManagerServer();

  /* Create all services */
  const authServer = new AuthServer(app);
  const broadcaster = new AllAreaBroadcaster(rpcDirectory, gameMap, gameState);
  const extensionManager = new ExtensionManager(rpcDirectory, broadcaster, gameMap, gameState);
  const gatewayService = new GatewayService(rpcDirectory, gameMap, authServer,
    broadcaster, io, extensionManager, movementManager);
  const assetServer = new AssetServer(app, extensionManager, null);

  /* Initialize static asset server */
  await assetServer.initialize();
  /* Start static asset server */
  assetServer.run();

  /* Initialize broadcaster and gateway service */
  const serviceName = ('service-name' in argv) ? argv['service-name'] : Object.keys(config.get('gatewayServers'))[0];
  await broadcaster.initialize();
  await gatewayService.initialize(serviceName);
  authServer.run();

  gatewayService.addServer(io);

  // TODO: Set the port once configuration is done.
  const port = config.get('gatewayServers')[serviceName].httpAddress.split(':')[1];
  console.log(`Gateway server is listening on port ${port} ...`);
  process.send('started'); // notify start-all that the gateway service has started.
  server.listen(port);
}

mainServer();
