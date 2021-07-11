# Service

TODO

## Gateway Service

The service name of the gateway service can be assigned via `... main-server.mjs --gateway-service <name>`. The default value is `gatewayServer`. Note that when there are multiple gateway services, their names must be unique.

## Service gRPC Server
Each service is assigned a gRPC server in multi-process mode. The address and port of the gRPC server are written in the Redis server using `HSET ServiceIndex <service name>`, so that the endpoint of each service is always fixed. Noted that if the service address doesn't exist in `ServiceIndex`, an error would be thrown.

Run `yarn node publish-service-address.js` to initialize the Redis server. The addresses of all services are hardcoded in `publish-service-address.js`, so if there are new services, you must update this file so that the new services can be registered in multi-process mode.