// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const promisify = require('util').promisify;
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const config = require('config');
const jwtVerify = promisify(require('jsonwebtoken').verify);
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const randomBytes = require('crypto').randomBytes;
const path = require('path');

import {fileURLToPath} from 'url';
import ContainerHandler from './container-handler.mjs';

const TERMINAL_SERVER_GRPC_PORT = '5051';

/**
 * The class for terminal server.
 */
class TerminalServer {
  constructor(app, io) {
    this.handlerProcesses = {};
    this.app = app;
    this.io = io;
    this.handlers = {};
    this.handler2sockets = {};

    this.defineServerMethods();
    this.createGrpcServer();

    this.setupContainerReaper();
  }

  /**
   * Add methods to Express.
   */
  defineServerMethods() {
    this.io.on('connection', (socket) => {
      socket.on('connectTerminal', async (msg) => {
        // Validation
        if (!('token' in msg)) {
          socket.emit('error', {data: 'No token found'});
          return;
        }

        if (typeof msg.token !== 'string') {
          socket.emit('error', {data: 'Token is not string'});
          return;
        }

        let containerId;
        try {
          let decodedToken = await jwtVerify(msg.token, config.get('secret'));
          containerId = decodedToken.containerId;
          console.log("container id", containerId);
        } catch (err) {
          console.warn(`JWT authentication failed for ${msg.token}: `, err);
          socket.emit('error', {data: 'Invalid token.'});
          return;
        }

        // Setup socket and container handler, and add a new PTY.
        socket.containerId = containerId;
        console.log("Set up socket!", containerId);
        let handler = this.handlers[containerId];
        if (handler === undefined) {
          socket.emit('error', {data: 'Container not found'});
          return;
        }
        await handler.statusLock.acquire('StatusRW', async () => {
          if (handler.handlerStatus !== 1) {
            socket.emit('error', {data: 'Container is down, ensure it first'});
            return;
          }
          this.handlers[containerId].newPty(socket);
          this.handler2sockets[containerId].add(socket);
          socket.emit('connected', {});
          this.addSocket(socket);
        });
      });
    });
  }

  /**
   * Register event listeners of the socket
   * @param {Socket} socket
   */
  addSocket(socket) {
    socket.on('disconnect', () => {
      this.handlers[socket.containerId].destroyPty(socket);
    });
  }

  /**
   * Create a container.
   * This method is called internally.
   * @param {string} imageName 
   * @param {string} containerId
   */
  async _createContainer(imageName, containerId) {
    try {
      await this.handlers[containerId].spawn();
      console.log('create container: ', containerId);
      return true;
    } catch (e) {
      console.error('create container failed: ', e);
      return false;
    }
  }

  /**
   * Create a containerHadler.
   * This method is exported as a service, and should be called via gRPC.
   * @param {Object} call - The gRPC message object <CreateContainerRequest>.
   * @param {Function} callback - Callback function.
   */
  async createContainerHandler(call, callback) {
    let containerId = randomBytes(32).toString('hex');
    const imageName = call.request.imageName;
    console.log("create containerHandler!", containerId, imageName);
    this.handler2sockets[containerId] = new Set();
    this.handlers[containerId] = new ContainerHandler(imageName);
    callback(null, {
      success: true, containerId: containerId
    });
  }

  /**
   * Destroy a container and kill all related socket.
   * This method is called internally.
   * @param {string} containerId 
   */
  async _destroyContainer(containerId) {
    try {
      await this.handlers[containerId].destroyContainer();
      for (const socket of this.handler2sockets[containerId]) {
        try {
          socket.disconnect(true);
        } catch (e) {
          console.warn(`Failed to disconnect socket for container ${containerId}: `, e);
        }
      }
      return true;
    } catch (e) {
      console.error(`Failed to destroy container${call.request.containerId}`, e);
      return false;
    }
  }

  /**
   * Destroy a containerHadler.
   * This method is exported as a service, and should be called via gRPC.
   * @param {Object} call - The gRPC message object <DestroyContainerRequest>.
   * @param {Function} callback - Callback function.
   */
  async destroyContainerHandler(call, callback) {
    const containerId = call.request.containerId;
    let handler = this.handlers[containerId];
    // illegal containerId
    if (handler === undefined) {
      callback(null, {
        success: false
      });
      return;
    }
    // Change the status to -1, the Reaper will destroy it later
    await handler.statusLock.acquire('StatusRW', async () => {
      handler.handlerStatus = -1;
      console.log('delete containerHandler: ', containerId);
      callback(null, {
        success: true
      });
    });
  }
  /**
   * Ensure the containerHadler has a available container.
   * This method is exported as a service, and should be called via gRPC.
   * @param {Object} call - The gRPC message object <DestroyContainerRequest>.
   * @param {Function} callback - Callback function.
   */
  async ensureContainerAvailable(call, callback) {
    let containerId = call.request.containerId;
    console.log("Ensure containerHandler!", containerId);
    let handler = this.handlers[containerId];
    // illegal containerId
    if (handler === undefined) {
      callback(null, {
        success: false, containerId: null
      });
      return;
    }
    await handler.statusLock.acquire('StatusRW', async () => {
      // These Container is dead
      if (handler.handlerStatus === -1) {
        console.log("These Container is dead");
        callback(null, {
          success: false, containerId: null
        });
        return;
      }
      // Container already exists
      if (handler.handlerStatus === 1) {
        handler.hasSecondChance = true;
        callback(null, {
          success: true, containerId: containerId
        });
        return;
      }
      // Else, create a new container for the handler
      const suc = await this._createContainer(call.request.imageName, call.request.containerId);
      if (suc) {
        handler.handlerStatus = 1;
        handler.hasSecondChance = true;
      } else {
        handler.handlerStatus = 0;
      }
      callback(null, {
        success: suc, containerId: containerId
      });
    });
  }

  /**
   * Create a gRPC server
   */
  createGrpcServer() {
    const packageDefinition = protoLoader.loadSync(
      path.dirname(fileURLToPath(import.meta.url)) + '/terminal.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    const rpcProto = grpc.loadPackageDefinition(packageDefinition).TerminalServer;
    let server = new grpc.Server();
    server.addService(rpcProto.TerminalServer.service, {
      CreateContainer: async (call, callback) => await this.createContainerHandler.bind(this)(call, callback),
      EnsureContainerAvailable: async (call, callback) => await this.ensureContainerAvailable.bind(this)(call, callback),
      DestroyContainer: async (call, callback) => await this.destroyContainer.bind(this)(call, callback)
    });
    server.bindAsync('0.0.0.0:' + TERMINAL_SERVER_GRPC_PORT, grpc.ServerCredentials.createInsecure(), () => {
      try {
        server.start();
        console.log("The gRPC server for the terminal server is running on port " + TERMINAL_SERVER_GRPC_PORT + ".");
      } catch (err) {
        console.error('Failed to create gRPC server: ', err);
        process.exit();
      }
    });
  }

  /**
   * The Reaper has two jobs:
   * 1. Implements a second-chance algorithm:
   *  If the player doesn't interact with the container for too long,
   *  destroy the container.
   * 2. Delete the unused containerHandler from the map
   */
  setupContainerReaper() {
    setInterval(obj => {
      let removeList = [];
      for (const containerId in obj.handlers) {
        const handler = obj.handlers[containerId];
        handler.statusLock.acquire('StatusRW', async () => {
          if (handler.handlerStatus === -1) {
            removeList.push(containerId);
          } else if (handler.handlerStatus === 1) {
            if (!handler.hasSecondChance) {
              this._destroyContainer(containerId);
              handler.handlerStatus = 0;
            } else {
              handler.hasSecondChance = false;
            }
          }
        });
      }
      for (const containerId in removeList) {
        this.handlers.delete(containerId);
        this.handler2sockets.delete(containerId);
      }
    }, config.get('secondChanceReaperInterval'), this);
  }
}

const expressHttpApp = express();
const server = http.createServer(expressHttpApp);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});
const terminalServer = new TerminalServer(expressHttpApp, io);

server.listen(config.get('serverPort'));
