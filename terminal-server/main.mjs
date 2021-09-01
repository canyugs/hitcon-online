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

import ContainerHandler from './container-handler.mjs';

/**
 * The class for terminal server.
 */
class TerminalServer {
  constructor(app, io) {
    this.handlerProcesses = {};
    this.app = app;
    this.io = io;
    this.handlers = {};
    this.room2sockets = {};

    this.defineServerMethods();
  }

  /**
   * Add methods to Express.
   */
  defineServerMethods() {
    this.io.on('connection', (socket) => {
      socket.on('authenticate', async (msg) => {
        // Validation
        if (!('token' in msg)) {
          socket.emit('unauthorized', {data: 'No token found'});
          return;
        }

        if (typeof msg.token !== 'string') {
          socket.emit('unauthorized', {data: 'Token is not string'});
          return;
        }

        let roomId;
        try {
          let decodedToken = await jwtVerify(msg.token, config.get('secret'));
          roomId = decodedToken.roomId;
        } catch (err) {
          console.error(err);
          socket.emit('unauthorized', {data: 'Invalid token.'});
          return;
        }

        // Setup socket and container handler, and add a new PTY.
        socket.roomId = roomId;
        if (!(roomId in this.handlers)) {
          await this.createContainerHandler(roomId);
        }
        this.handlers[roomId].newPty(socket);
        this.room2sockets[roomId].add(socket);

        socket.emit('authenticated', {});
        this.addSocket(socket);
      });
    });
  }

  /**
   * @param {Socket} socket
   */
  addSocket(socket) {
    socket.on('disconnect', () => {
      this.handlers[socket.roomId].destroyPty(socket);
    });

    socket.on('destroyPty', () => {
      this.handlers[socket.roomId].destroyPty(socket);
      socket.close();
    });

    socket.on('destroyContainer', () => {
      this.destroyContainer(socket.roomId);
    });
  }

  /**
   * Create a container handler.
   * @param {string} roomId The identifier.
   */
  async createContainerHandler(roomId) {
    if (roomId in this.handlers) {
      return;
    }

    this.room2sockets[roomId] = new Set();
    this.handlers[roomId] = new ContainerHandler();
    await this.handlers[roomId].spawn();
  }

  /**
   * Destroy container and kill all related
   * @param {string} roomId The identifier.
   */
  async destroyContainer(roomId) {
    await this.handlers[roomId].destroyContainer();
    if (!(roomId in this.room2sockets)) {
      return;
    }
    for (const socket in this.room2sockets[roomId]) {
      try {
        socket.disconnect(true);
      } catch (e) {
        console.warn(e);
      }
    }
    delete this.handlers[roomId];
    delete this.room2sockets[roomId];
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