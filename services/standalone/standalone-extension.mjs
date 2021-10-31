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
import GraphicAsset from '../../common/maplib/graphic-asset.mjs';
import GameState from '../../common/gamelib/game-state.mjs';
import ExtensionManager from '../../common/extlib/extension-manager.mjs';
import {getRunPath, getConfigPath} from '../../common/path-util/path.mjs';

async function standaloneExtensionServer() {
  /* Create all utility classes */
  const rpcDirectory = new MultiProcessRPCDirectory();
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
  const broadcaster = new AllAreaBroadcaster(rpcDirectory, gameMap, gameState);
  const extensionManager = new ExtensionManager(rpcDirectory, broadcaster, gameMap, gameState);

  await broadcaster.initialize();

  if (!('ext' in argv)) {
    console.error('Please specify extension name via --ext argument.');
    process.exit();
  }
  const extName = argv.ext;
  await extensionManager.ensureClass('blank');
  await extensionManager.createExtensionService(extName);
  process.send('ready'); // notify start-all that the standalone extension service is ready to start.

  // wait for the start-all to signal that the extension can start.
  await new Promise(resolve =>
    process.on('message', async (msg) => {
      if (msg === 'start') resolve();
    })
  );

  await extensionManager.startExtensionService(extName);
}

standaloneExtensionServer();
