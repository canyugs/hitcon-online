// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Boilerplate for getting require() in es module.
import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

import assert from 'assert';
import Directory from './directory.mjs'
import Handler from './handler.mjs'
import { promisify } from 'util';
import { fileURLToPath } from 'url';

/**
 * This class is handling all RPC calls in Multi Process version, which does IPC by gRPC.
 */
class MultiProcessRPCDirectory extends Directory {
  /**
   * Create the RPC Directory.
   * @constructor
   * @param {String} address - address of this RPC directory
   */
  constructor() {
    super();
    this.handlers = {};
    this.remoteCallRPC = {};
    this.remoteServiceAddress = {};

    const packageDefinition = protoLoader.loadSync(path.dirname(fileURLToPath(import.meta.url)) + '/rpc.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    this.rpcProto = grpc.loadPackageDefinition(packageDefinition).RPC;
  }

  /**
   * Part of the constructor that needs to be async.
   * This is created because constructor can't be async.
   * Note that this is called right after the constructor.
   */
  async asyncConstruct() {
  }

  /**
   * Create a gRPC server and publish it to Redis.
   * Should only be called by standalone extension process.
   * @param {String} port - port number
   * @returns
   */
  createGrpcServer(name, port) {
    let server = new grpc.Server();
    server.addService(this.rpcProto.RPC.service, { callRPC: async (call, callback) => await this.responseGrpcCall.bind(this)(call, callback, this.callLocalRPC) });

    server.bindAsync('0.0.0.0:' + port, grpc.ServerCredentials.createInsecure(), () => {
      try {
        server.start();
        console.log("The gRPC server for " + name + " is running on port " + port + ".");
      } catch(err) {
        console.error('Failed to create gRPC server.');
        console.error(err);
        process.exit();
      }
    });
  }

  /**
   * Method for responing gRPC, should only be called by gRPC server.
   * @param {Object} call - The request content, contains the same signature as callRPC.
   * @param {Function} callback - Callback function.
   * @param {Object} callLocalRPC - A method to call local RPC.
   */
  async responseGrpcCall(call, callback, callLocalRPC) {
    callback(null, {
      response: JSON.stringify(await callLocalRPC.bind(this)(call.request.callerServiceName, call.request.serviceName, call.request.methodName, ...JSON.parse(call.request.args)))
    });
  }

  /**
   * Call an RPC method.
   * Should be called via Handler or gRPC server, do not called this method directly.
   * @param {String} callerServiceName - The name of the caller service.
   * @param {String} serviceName - The name of the service.
   * @param {String} methodName - The name of the method.
   * @param {Object} args - The arguments.
   * @return {Object} result - The result of the call.
   */
   async callRPC(callerServiceName, serviceName, methodName, ...args) {
    void [callerServiceName, serviceName, methodName, args];
    // local service
    if((serviceName in this.handlers)){
      if(!(methodName in this.handlers[serviceName].methods)){
        throw `Method ${methodName} not found.`;
      }
      return await this.handlers[serviceName].methods[methodName](callerServiceName, ...args);
    }

    // remote service
    if(!(serviceName in this.remoteCallRPC)){
      let remoteAddress = await this.redis.hgetAsync("ServiceIndex", serviceName);
      if(remoteAddress){
        let gRPCService = new this.rpcProto.RPC(remoteAddress, grpc.credentials.createInsecure());
        this.remoteCallRPC[serviceName] = gRPCService;
      }
    }

    if(this.remoteCallRPC[serviceName]){
      let ret = await promisify(this.remoteCallRPC[serviceName].callRPC.bind(this.remoteCallRPC[serviceName]))({
        callerServiceName: callerServiceName,
        serviceName: serviceName,
        methodName: methodName,
        args: JSON.stringify(args)
      }, {deadline: new Date(Date.now() + 5000)});
      return JSON.parse(ret.response);
    }

    // no service found
    throw `Service ${serviceName} not found.`;
  }

  /**
   * Call a local RPC method.
   * Should be called via gRPC handler, do not called this method directly.
   * @param {String} callerServiceName - The name of the caller service.
   * @param {String} serviceName - The name of the service.
   * @param {String} methodName - The name of the method.
   * @param {Object} args - The arguments.
   * @return {Object} result - The result of the call.
   */
   async callLocalRPC(callerServiceName, serviceName, methodName, ...args) {
    void [callerServiceName, serviceName, methodName, args];
    // local service
    if((serviceName in this.handlers)){
      if(!(methodName in this.handlers[serviceName].methods)){
        throw `Method ${methodName} not found.`;
      }
      return await this.handlers[serviceName].methods[methodName](callerServiceName, ...args);
    }

    // no service found
    throw `Service ${serviceName} not found.`;
  }

  /**
   * Register a service
   * @param {string} name - The name of the service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  async registerService(name) {
    if(name in this.handlers){
        throw 'A service with the same name has been registered';
    }
    this.handlers[name] = new Handler(name, this);

    // Get the address and port for the gRPC server
    try {
      let port = (await this.redis.hgetAsync("ServiceIndex", name)).split(':')[1];
      this.createGrpcServer(name, port);
    } catch {
      throw 'Failed to create gRPC server:' + name;
    }

    return this.handlers[name];
  }
}

export default MultiProcessRPCDirectory;
