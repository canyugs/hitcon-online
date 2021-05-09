const express = require('express');
const path = require('path');
const config = require('config');
const redis = require('redis');

/* Import all servers */
const GatewayService = require('../gateway/gateway-service');

/* Import configuration */
const globalConfig = config.get('hitconOnline');
const gatewayServerConfig = config.get('hitconOnline.gatewayServerConfig');

/*
 * const RPCServer = require('./rcp-server');
 * const StaticAssetServer = require('./static-asset-server');
 * const ExtensionServer = require('./extension-server');
 * const AuthServer = require('./auth-server');
 */

function mainServer() {
    /* Redis integration */
    /*
    redisClient = redis.createClient();
    redisClient.on('error', (err) => {
        console.error(err);
    });
    */
    
    /* Start gateway service */

    rpcDirectory = globalConfig.rcpDirectory;
    gatewayService = new GatewayService(this.rpcDirectory);
    gatewayService.initialize();

    /* Other operations of gateway service */

    /* Startup other servers */
}

if (require.main === module) {
    mainServer();
}
