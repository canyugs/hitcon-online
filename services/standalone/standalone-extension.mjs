// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');
const argv = require('minimist')(process.argv.slice(2));
import fs from 'fs';

/* Import all servers */
import AllAreaBroadcaster from '../gateway/all-area-broadcaster.mjs';
import MultiProcessRPCDirectory from
  '../../common/rpc-directory/multi-process-RPC-directory.mjs';

/* Import all utility classes */
import GameMap from '../../common/maplib/map.mjs';
import ExtensionManager from '../../common/extlib/extension-manager.mjs';

async function standaloneExtensionServer() {
  /* Redis integration */
  // TODO: Uncomment once configuration for redis is done.
  // redisClient = redis.createClient();
  // redisClient.on('error', (err) => {
  //   console.error(err);
  // });

  /* Create all utility classes */
  const rpcDirectory = new MultiProcessRPCDirectory();
  await rpcDirectory.asyncConstruct();
  // Load the map.
  const mapList = config.get("map");
  const rawMapJSON = fs.readFileSync(mapList[0]);
  const mapJSON = JSON.parse(rawMapJSON);
  // We do not have GraphicAsset on the server side.
  const gameMap = new GameMap(undefined, mapJSON);
  const broadcaster = new AllAreaBroadcaster(rpcDirectory, gameMap);
  const extensionManager = new ExtensionManager(rpcDirectory, broadcaster);

  if(!('ext' in argv)){
    console.error('Please specify extension name via --ext argument.');
    process.exit();
  }
  const extName = argv.ext;
  await extensionManager.ensureClass('blank');
  await extensionManager.createExtensionService(extName);
  await extensionManager.startExtensionService(extName);
}

standaloneExtensionServer();
