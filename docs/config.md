# Config
This is the documentation of config file `run/config/....json`.

## `redis`
The `type` field controls the Redis mode. `type: "mock"` uses the mock Redis, no additional setup required. `type: "real"` uses real Redis, which requires setting up a Redis server.
The `option` field should control the connection information of the Redis server, but it hasn't been implemented.

## `multiprocess`
Run multi-process mode or not. The multi-process mode requires real Redis, preloaded services addresses (check service.md for more information), and gRPC modules.

## `ext`
The `enabled` field controls which extension should be loaded in this main process.