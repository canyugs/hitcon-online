// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// This script starts all services, including gateway services and standalone extensions.

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const redis = require('redis');
const promisify = require('util').promisify;
const config = require('config');
const fork = require('child_process').fork;

async function main() {
  /* start-all.mjs should only be used in multi-process mode */
  if(!config.get('multiprocess')) {
    console.error("The start-all.mjs should only be used in multi-process mode.");
    return;
  }

  /* Initialize Redis */
  const redisClient = redis.createClient();
  redisClient.on('error', (err) => {
    console.error("Can't connect to Redis, make sure that the connection info is correct.");
    process.exit();
  });

  // Push the extension addresses onto Redis.
  try {
    const hmset = promisify(redisClient.hmset).bind(redisClient);
    const flushall = promisify(redisClient.flushall).bind(redisClient);
    await flushall();

    const ext_addresses = config.get('ext.standalone');
    for(const ext in ext_addresses){
      await hmset("ServiceIndex", "ext_" + ext, ext_addresses[ext]);
    }

    const servers = config.get('gatewayServers');
    for(const serverName in servers){
      await hmset("ServiceIndex", serverName, servers[serverName].grpcAddress);
    }

  } catch {
    console.error("Failed to initialize Redis.");
    process.exit();
  };

  // Quit Redis connection since we no longer need it.
  // The child processes would create their own connections.
  redisClient.quit();

  /* Start asset server */
  const assetServer = fork('../services/main/asset-server.mjs', { cwd: '.' });

  /* Start gateway service */
  const gatewayServers = {};
  const enabledGatewayServers = config.get('gatewayServers');
  for(const serverName in enabledGatewayServers){
    gatewayServers[serverName] = fork('../services/main/gateway-server.mjs', ['--service-name', serverName], { cwd: '.' });
  }

  // Wait for all gateway services to start.
  const promises = Object.keys(gatewayServers).map((serverName) => {
    return new Promise((resolve, reject) => {
      gatewayServers[serverName].on('message', msg => {
        if(msg !== 'started') return;
        console.log(`${serverName} has started successfully.`)
        resolve(msg)
      });
      const timer = setTimeout(() => {
        reject(new Error(`Promise timed out after 10 sec.`));
      }, 10 * 1000);
    });
  });
  await Promise.all(promises);

  /* Start standalone extension services */
  const extServices = {};
  const enabledExtStandalone = config.get('ext.standalone');
  for(const ext in enabledExtStandalone){
    extServices[ext] = fork('../services/standalone/standalone-extension.mjs', ['--ext', ext], { cwd: '.' });
  }

  /* Hook error handlers */
  const handler = (message, err) => {
    console.error(message);
    console.error(err);

    try {
      assetServer.kill();
    } catch {};

    for(const serverName in enabledGatewayServers){
      try {
        gatewayServers[serverName].kill();
      } catch {};
    }

    for(const ext in enabledExtStandalone){
      try {
        extServices[ext].kill();
      } catch {};
    }

    process.exit();
  }

  assetServer.on('error', (err) => { handler('Asset service error.', err) });
  assetServer.on('close', (err) => { handler('Asset service closed.', err) });

  for(const serverName in enabledGatewayServers){
    gatewayServers[serverName].on('error', (err) => { handler(serverName + ' service error.', err) });
    gatewayServers[serverName].on('close', (err) => { handler(serverName + ' service closed.', err) });
  }
  for(const ext in enabledExtStandalone){
    extServices[ext].on('error', (err) => { handler(ext + ' service error.', err) });
    extServices[ext].on('close', (err) => { handler(ext + ' service closed.', err) });
  }
}

main();
