// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const express = require('express');
const path = require('path');
const config = require('config');
const redis = require('redis');

/* Import all servers */
import GatewayService from '../gateway/gateway-service.mjs';
import Directory from '../../common/rpc-directory/directory.mjs';
import StaticAssetServer from './static-asset-server.mjs';

function mainServer() {
  /* Redis integration */
  // TODO: Uncomment once configuration for redis is done.
  // redisClient = redis.createClient();
  // redisClient.on('error', (err) => {
  //   console.error(err);
  // });

  /* Create all services */
  const app = express();
  const staticAssetServer = new StaticAssetServer(app);
  // TODO: Uncomment the following when RPC Directory is implemented.
  // let rpcDirectory = new Directory();
  // gatewayService = new GatewayService(rpcDirectory);

  /* Start all services */
  staticAssetServer.initialize();
  // TODO: Uncomment the following when RPC Directory is implemented.
  // gatewayService.initialize();

  // TODO: Set the port once configuration is done.
  app.listen(config.get('server.port'));
}

mainServer();
