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
  constructor(address) {
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
    this.serverInfo = { address: address }
  }

  /**
   * Part of the constructor that needs to be async.
   * This is created because constructor can't be async.
   * Note that this is called right after the constructor.
   */
  async asyncConstruct() {
    console.log("RPCDirectory", this.serverInfo.address, JSON.stringify([]));
    await this.redis.hsetAsync("RPCDirectory", this.serverInfo.address, JSON.stringify([]));

    // subscribe to service registration in other directories.
    this.redisSub.on("message", (channel, message) => {
      if(channel != "RPCDirectoryUpdate") return;
      const [serviceName, directoryAddress] = message.split('@');

      if(directoryAddress === this.serverInfo.address) return; //shouldn't happen
      this.registerRemoteService(serviceName, directoryAddress);
    });
    await this.redisSub.subscribeAsync("RPCDirectoryUpdate");

    // load existing services
    const allServices = await this.redis.hgetallAsync('RPCDirectory');
    console.log("loading existing services:", allServices);
    for(const address in allServices) {
      if(address === this.serverInfo.address) continue;
      const serviceNames = JSON.parse(allServices[address]);
      for(const i in serviceNames){
        this.registerRemoteService(serviceNames[i], address);
      }
    }
  }

  /**
   * Create a gRPC server and publish it to Redis.
   * Should only be called by standalone extension process.
   * @param {String} port - port number
   * @returns
   */
  createGrpcServer(port) {
    console.log('0.0.0.0:' + port);
    let server = new grpc.Server();
    server.addService(this.rpcProto.RPC.service, { callRPC: async (call, callback) => await this.responseGrpcCall.bind(this)(call, callback, this.callRPC) });
    server.bindAsync('0.0.0.0:' + port, grpc.ServerCredentials.createInsecure(), () => {
      console.log("server started: ", port)
      server.start();
    });
  }

  /**
   * Method for responing gRPC, should only be called by gRPC server.
   * @param {Object} call - The request content, contains the same signature as callRPC.
   * @param {Function} callback - Callback function.
   * @param {Object} handlers - The handler of this class.
   */
  async responseGrpcCall(call, callback, callRPC) {
    console.log(call);
    callback(null, {
      response: JSON.stringify(await callRPC.bind(this)(call.request.callerServiceName, call.request.serviceName, call.request.methodName, ...JSON.parse(call.request.args)))
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
    console.log("callRPC", callerServiceName, serviceName, methodName, args);
    // local service
    if((serviceName in this.handlers)){
      if(!(methodName in this.handlers[serviceName].methods)){
        throw `Method ${methodName} not found.`;
      }
      return await this.handlers[serviceName].methods[methodName](callerServiceName, ...args);
    }
    // remote service
    if(serviceName in this.remoteServiceAddress){
      const address = this.remoteServiceAddress[serviceName];

      let ret = await promisify(this.remoteCallRPC[address].callRPC.bind(this.remoteCallRPC[address]))({
        callerServiceName: callerServiceName,
        serviceName: serviceName,
        methodName: methodName,
        args: JSON.stringify(args)
      });
      console.log("gRPC response", ret.response);
      return JSON.parse(ret.response);
    }
    throw `Service ${serviceName} not found.`;
  }

  /**
   * Register a remote service
   * @param {string} name - The name of the remote service.
   * @param {string} address - The address of the remote service.
   * @return {Handler} handler - The handler object for the registered
   * service. Service should register all API handlers with it.
   */
  async registerRemoteService(name, address) {
    console.log("registerRemoteService", name, address);
    this.remoteServiceAddress[name] = address;

    if(!(address in this.remoteCallRPC)){
      let gRPCService = new this.rpcProto.RPC(address, grpc.credentials.createInsecure());
      this.remoteCallRPC[address] = gRPCService;
    }

    return this.handlers[name];
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

    // Publish the service name, do not publish gateway service since every process has unique one.
    if(name !== "gatewayServer"){
      const currentServiceList = (JSON.parse(await this.redis.hgetAsync("RPCDirectory", this.serverInfo.address) ?? "[]")).concat([name]);
      console.log(currentServiceList);
      console.log("RPCDirectory", this.serverInfo.address, JSON.stringify(currentServiceList));
      await this.redis.hsetAsync("RPCDirectory", this.serverInfo.address, JSON.stringify(currentServiceList));

      await this.redis.publishAsync("RPCDirectoryUpdate", name + "@" + this.serverInfo.address);
    }
    return this.handlers[name];
  }
}

export default MultiProcessRPCDirectory;
