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
import fs from 'fs';

/* Import all servers */
import GatewayService from '../gateway/gateway-service.mjs';
import Directory from '../../common/rpc-directory/directory.mjs';
import SingleProcessRPCDirectory from
  '../../common/rpc-directory/SingleProcessRPCDirectory.mjs';
import StaticAssetServer from './static-asset-server.mjs';

/* Import all utility classes */
import GameMap from '../../common/maplib/map.mjs';

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
  // Load the map.
  const mapList = config.get("map");
  const rawMapJSON = fs.readFileSync(mapList[0]);
  const mapJSON = JSON.parse(rawMapJSON);
  // We do not have GraphicAsset on the server side.
  const gameMap = new GameMap(undefined, mapJSON);

  /* Create all services */
  const staticAssetServer = new StaticAssetServer(app);
  const rpcDirectory = new SingleProcessRPCDirectory();
  const gatewayService = new GatewayService(rpcDirectory, gameMap);

  /* Initialize static asset server */
  staticAssetServer.initialize();
  /* Start static asset server */
  staticAssetServer.run();
  gatewayService.initialize();

  // TODO: Set the port once configuration is done.
  console.log(`Server is listening on port ${config.get('server.port')} ...`);
  server.listen(config.get('server.port'));
}

mainServer();
