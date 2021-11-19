// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// This script starts all services, including gateway services and standalone extensions.

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const redis = require('redis');
const promisify = require('util').promisify;
const config = require('config');
const fork = require('child_process').fork;
const {Transform} = require('stream');

// https://stackoverflow.com/a/45126242
const prepender = (prefix) => {
  const prefixBuffer = Buffer.from(prefix);
  return new Transform({
    transform(chunk, encoding, done) {
      this._rest = this._rest && this._rest.length ?
        Buffer.concat([this._rest, chunk]) :
        chunk;

      let index;

      // As long as we keep finding newlines, keep making slices of the buffer and push them to the
      // readable side of the transform stream
      while ((index = this._rest.indexOf('\n')) !== -1) {
        // The `end` parameter is non-inclusive, so increase it to include the newline we found
        const line = this._rest.slice(0, ++index);
        // `start` is inclusive, but we are already one char ahead of the newline -> all good
        this._rest = this._rest.slice(index);
        // We have a single line here! Prepend the string we want
        this.push(Buffer.concat([prefixBuffer, line]));
      }

      return void done();
    },

    // Called before the end of the input so we can handle any remaining
    // data that we have saved
    flush(done) {
      // If we have any remaining data in the cache, send it out
      if (this._rest && this._rest.length) {
        return void done(null, Buffer.concat([prefixBuffer, this._rest]));
      }
    },
  });
};

async function main() {
  /* start-all.mjs should only be used in multi-process mode */
  if (!config.get('multiprocess')) {
    console.error('The start-all.mjs should only be used in multi-process mode.');
    return;
  }

  /* Initialize Redis */
  const redisClient = redis.createClient(config.get('redis.option'));
  redisClient.on('error', (err) => {
    console.error('Can\'t connect to Redis, make sure that the connection info is correct: ', err);
    process.exit();
  });

  // Push the extension addresses onto Redis.
  try {
    const hmset = promisify(redisClient.hmset).bind(redisClient);
    const flushall = promisify(redisClient.flushall).bind(redisClient);
    await flushall();

    const extEnabled = config.get('ext.enabled');
    const extAddresses = config.get('ext.standalone');
    let standaloneAutoPort, standaloneAutoAddr;
    try {
      standaloneAutoPort = config.get('ext.standaloneAuto.port');
      standaloneAutoAddr = config.get('ext.standaloneAuto.addr');
    } catch (e) {
      // This is expected.
    }
    for (const ext of extEnabled) {
      let curAddr = extAddresses[ext];
      if (typeof curAddr !== 'string' && typeof standaloneAutoAddr === 'string') {
        curAddr = `${standaloneAutoAddr}:${standaloneAutoPort}`;
        standaloneAutoPort++;
      }
      await hmset('ServiceIndex', 'ext_' + ext, curAddr);
    }

    const servers = config.get('gatewayServers');
    for (const serverName in servers) {
      await hmset('ServiceIndex', serverName, servers[serverName].grpcAddress);
    }
  } catch {
    console.error('Failed to initialize Redis.');
    process.exit();
  }

  // Quit Redis connection since we no longer need it.
  // The child processes would create their own connections.
  redisClient.quit();

  /* Start asset server */
  const assetServer = fork('./services/assets/asset-server-launcher.mjs', {cwd: '.', stdio: 'pipe'});
  assetServer.stdout.pipe(prepender(`[Asset Server] `)).pipe(process.stdout);
  assetServer.stderr.pipe(prepender(`[Asset Server] `)).pipe(process.stderr);

  /* Start gateway service */
  const gatewayServers = {};
  const enabledGatewayServers = config.get('gatewayServers');
  for (const serverName in enabledGatewayServers) {
    gatewayServers[serverName] = fork('./services/gateway/gateway-server.mjs', ['--service-name', serverName], {cwd: '.', stdio: 'pipe'});
    gatewayServers[serverName].stdout.pipe(prepender(`[Gateway ${serverName}] `)).pipe(process.stdout);
    gatewayServers[serverName].stderr.pipe(prepender(`[Gateway ${serverName}] `)).pipe(process.stderr);
  }

  // Wait for all gateway services to start.
  const gatewayPromises = Object.entries(gatewayServers).map((entry) => {
    const [name, server] = entry;
    return new Promise((resolve, reject) => {
      server.on('message', (msg) => {
        if (msg === 'started') resolve(msg);
      });
      setTimeout(() => {
        reject(new Error(`Failed to start "${name}" server successfully in 60 seconds.`));
      }, 60 * 1000);
    });
  });
  await Promise.all(gatewayPromises);

  /* Start standalone extension services */
  const extServices = {};
  const enabledExtStandalone = config.get('ext.enabled');
  for (const ext of enabledExtStandalone) {
    extServices[ext] = fork('./services/standalone/standalone-extension.mjs', ['--ext', ext], {cwd: '.', stdio: 'pipe'});
    extServices[ext].stdout.pipe(prepender(`[Extension ${ext}] `)).pipe(process.stdout);
    extServices[ext].stderr.pipe(prepender(`[Extension ${ext}] `)).pipe(process.stderr);
  }

  // Wait for all standalone extension services to be ready.
  const standalonePromises = Object.entries(extServices).map((entry) => {
    const [name, server] = entry;
    return new Promise((resolve, reject) => {
      server.on('message', (msg) => {
        if (msg === 'ready') resolve(msg);
      });
      setTimeout(() => {
        reject(new Error(`Failed to start "${name}" extension successfully in 60 seconds.`));
      }, 60 * 1000);
    });
  });
  await Promise.all(standalonePromises);

  // Notify that the extension can start.
  for (const ext of enabledExtStandalone) {
    extServices[ext].send('start');
  }

  /* Hook error handlers */
  const handler = (message, err) => {
    console.error(message, err);

    try {
      assetServer.kill();
    } catch {}

    for (const serverName in enabledGatewayServers) {
      try {
        gatewayServers[serverName].kill();
      } catch {}
    }

    for (const ext of enabledExtStandalone) {
      try {
        extServices[ext].kill();
      } catch {}
    }

    process.exit();
  };

  assetServer.on('error', (err) => {
    handler('Asset service error.', err);
  });
  assetServer.on('close', (err) => {
    handler('Asset service closed.', err);
  });

  for (const serverName in enabledGatewayServers) {
    gatewayServers[serverName].on('error', (err) => {
      handler(serverName + ' service error.', err);
    });
    gatewayServers[serverName].on('close', (err) => {
      handler(serverName + ' service closed.', err);
    });
  }
  for (const ext of enabledExtStandalone) {
    extServices[ext].on('error', (err) => {
      handler(ext + ' service error.', err);
    });
    extServices[ext].on('close', (err) => {
      handler(ext + ' service closed.', err);
    });
  }
}

main();
