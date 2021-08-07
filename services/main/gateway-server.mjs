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
import MultiProcessRPCDirectory from
  '../../common/rpc-directory/multi-process-RPC-directory.mjs';
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
  app.use(require('cors')({
    origin: '*'
  }));
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: true,
    origins: ["*"],
  });

  /* Create all utility classes */
  const rpcDirectory = config.get('multiprocess')
                        ? (new MultiProcessRPCDirectory())
                        : (new SingleProcessRPCDirectory());
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

  /* Initialize broadcaster and gateway service */
  const serviceName = ('service-name' in argv) ? argv['service-name'] : Object.keys(config.get('gatewayServers'))[0];
  await broadcaster.initialize();
  await gatewayService.initialize(serviceName);
  authServer.run();

  gatewayService.addServer(io);

  // TODO: Set the port once configuration is done.
  const port = config.get('gatewayServers')[serviceName].httpAddress.split(':')[1];
  console.log(`Server is listening on port ${port} ...`);
  server.listen(port);
}

mainServer();
