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
      console.log('set', ext, ext_addresses[ext]);
      await hmset("ServiceIndex", "ext_" + ext, ext_addresses[ext]);
    }
    await hmset("ServiceIndex", "gatewayServer", "127.0.0.1:5001");
  } catch {
    console.error("Failed to initialize Redis.");
    process.exit();
  };

  // Quit Redis connection since we no longer need it.
  // The child processes would create their own connections.
  redisClient.quit();

  /* Start gateway service */
  const gatewayService = fork('../services/main/main-server.mjs', ['--gateway-service', 'gatewayServer'], { cwd: '.' });

  /* Start standalone extension services */
  const extServices = {};
  const enabledExtStandalone = config.get('ext.standalone');
  console.log(enabledExtStandalone);
  console.log(config.get('ext.enabled'));
  for(const ext in enabledExtStandalone){
    if(config.get('ext.enabled').includes(ext)) continue;
    extServices[ext] = fork('../services/standalone/standalone-extension.mjs', ['--ext', ext], { cwd: '.' });
  }

  /* Hook error handlers */
  const handler = (message, err) => {
    console.error(message);
    console.error(err);

    try {
      gatewayService.kill();
    } catch {};

    for(const ext in enabledExtStandalone){
      if(config.get('ext.enabled').includes(ext)) continue;
      try {
        extServices[ext].kill();
      } catch {};
    }

    process.exit();
  }

  gatewayService.on('error', (err) => { handler('Gateway service error.', err) });
  gatewayService.on('close', (err) => { handler('Gateway service closed.', err) });
  for(const ext in enabledExtStandalone){
    if(config.get('ext.enabled').includes(ext)) continue;
    extServices[ext].on('error', (err) => { handler(ext + ' service error.', err) });
    extServices[ext].on('close', (err) => { handler(ext + ' service closed.', err) });
  }
}

main();