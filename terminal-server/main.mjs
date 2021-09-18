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
    this.container2sockets = {};

    this.defineServerMethods();
    this.createGrpcServer();
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
        } catch (err) {
          console.error(err);
          socket.emit('error', {data: 'Invalid token.'});
          return;
        }

        // Setup socket and container handler, and add a new PTY.
        socket.containerId = containerId;
        if (!(containerId in this.handlers)) {
          socket.emit('error', {data: 'Container not found'});
        }
        this.handlers[containerId].newPty(socket);
        this.container2sockets[containerId].add(socket);

        socket.emit('connected', {});
        this.addSocket(socket);
      });
    });
  }

  /**
   * @param {Socket} socket
   */
  addSocket(socket) {
    socket.on('disconnect', () => {
      this.handlers[socket.containerId].destroyPty(socket);
    });

    socket.on('destroyPty', () => {
      this.handlers[socket.containerId].destroyPty(socket);
      socket.close();
    });
  }

  /**
   * Create a container.
   * @param {Object} call - The gRPC message object <CreateContainerRequest>.
   * @param {Function} callback - Callback function.
   */
  async createContainer(call, callback) {
    try {
      let containerId = randomBytes(32).toString('hex');

      this.container2sockets[containerId] = new Set();
      this.handlers[containerId] = new ContainerHandler(call.request.imageName);
      await this.handlers[containerId].spawn();
      console.log('create container', containerId);

      callback(null, {
        success: true,
        containerId: containerId
      });
    } catch (e) {
      console.error(e);
      callback(null, {
        success: false,
        containerId: null
      });
    }
  }

  /**
   * Destroy container and kill all related socket.
   * @param {Object} call - The gRPC message object <DestroyContainerRequest>.
   * @param {Function} callback - Callback function.
   */
  async destroyContainer(call, callback) {
    try {
      const containerId = call.request.containerId;

      if (!(containerId in this.handlers) || !(containerId in this.container2sockets)) {
        throw new Error(`Container ${containerId} not found.`);
      }

      await this.handlers[containerId].destroyContainer();
      for (const socket in this.container2sockets[containerId]) {
        try {
          socket.disconnect(true);
        } catch (e) {
          console.warn(e);
        }
      }
      delete this.handlers[containerId];
      delete this.container2sockets[containerId];
      console.log('delete container', containerId);

      callback(null, {
        success: true
      });
    } catch (e) {
      console.error(e);
      callback(null, {
        success: false
      });
    }

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
      CreateContainer: async (call, callback) => await this.createContainer.bind(this)(call, callback),
      DestroyContainer: async (call, callback) => await this.destroyContainer.bind(this)(call, callback)
    });
    server.bindAsync('0.0.0.0:' + TERMINAL_SERVER_GRPC_PORT, grpc.ServerCredentials.createInsecure(), () => {
      try {
        server.start();
        console.log("The gRPC server for the terminal server is running on port " + TERMINAL_SERVER_GRPC_PORT + ".");
      } catch (err) {
        console.error('Failed to create gRPC server.');
        console.error(err);
        process.exit();
      }
    });
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});
const terminalServer = new TerminalServer(app, io);

server.listen(config.get('serverPort'));