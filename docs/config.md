# Config
This is the documentation of config file `run/config/....json`.

## `gatewayServers`
Each gateway server has to be assigned two address, one for the HTTP server, and the other for the gRPC server. The HTTP server have to be accessible either globally or to the nginx load balancer, depending on the set up. The gRPC servers have to be accessible to all other services, including gateway services and standalone extensions.

## `redis`
The `type` field controls the Redis mode. `type: "mock"` uses the mock Redis, no additional setup required. `type: "real"` uses real Redis, which requires setting up a Redis server.
The `option` field should control the connection information of the Redis server, but it hasn't been implemented.

## `multiprocess`
Run multi-process mode or not. The multi-process mode requires real Redis, preloaded services addresses (check service.md for more information), and gRPC modules.

## `ext`
The `enabled` field controls which extension should be loaded in this main process.
The `standalone` object controls the address and port used by the gRPC server of each standalone extension.

## `publicAddresses`
Includes `assetService` and `gatewayService`, standing for the addresses for the gateway server and the asset server. These addresses are used by the Nginx reverse proxy and CORS. If these are not assigned, CORS would be set to `*`, the reverse proxy wouldn't work, and the asset server would serve the raw address of a randomly chosen gateway server.