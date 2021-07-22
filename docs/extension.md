# Extension
In short, there are three components in an extension: client-side, in-gateway, and standalone.

## Client-side Extension
TODO

## In-gateway Extension
Have not implemented.

TODO: explain what In-Gateway Extension is.

## Standalone Extension
A standalone extension can be executed by:
```
./run-ext.sh helloworld
```

In a standalone extension process, only ExtensionManager, AllAreaBroadcaster (without Socket IO), and RPCDirectory are loaded. Therefore, the standalone extension can't access Socket IO.

Since standalone extensions are located in isolated processes and using gRPC to communicate, they are more suitable for CPU-intensive tasks, but have inevitable communication overhead.

When developing, run `./run-dev.sh` before starting any standalone extension because `./run-dev.sh` would clear the Redis.

The source code is located at `services/standalone/standalone-extension.mjs`.