# Service

TODO

## Gateway Service

In single-process mode, the gateway service would not enable gRPC.
In multi-process mode, there can be serveral gateway servers, defined in the config file. The service names of the gateway services are the key in the config file.

## Service gRPC Server
Each service is assigned a gRPC server in multi-process mode. The address and port of the gRPC server are written in the Redis server using `HSET ServiceIndex <service name>`, so that the endpoint of each service is always fixed. Noted that if the service address doesn't exist in `ServiceIndex`, an error would be thrown.