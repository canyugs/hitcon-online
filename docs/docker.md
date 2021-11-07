# Docker

This documentation is about how to run hitcon-online in Docker.
In short:
```
cd docker
docker-compose up -d
```

Currently there are four containers, for `redis`, `nginx`/`haproxy` (for reverse proxy and load balancing), and `online` (main container for hitcon-online). Make sure that multiprocess mode is enabled and `publicAddress` is assigned. Both nginx and haproxy path works and is available for the user to choose.

The nginx/haproxy config file *will not* be automatic generated. You have to do `python3 generate-conf.py run_dir [config name]` to generate one, and restart the nginx/haproxy container to take effect.

By default, only port 80 (from Nginx/haproxy) is exposed to the host (on port 14000/15000). One can access hitcon-online through `online.hitcon.org`. This is a temporary location, we might not use it in production.

Also, modify the `hosts` file so that the temporary address works.
```
127.0.0.1       online.hitcon.org
```

Note that the gateway services config can be generated with:
```
print('\n'.join(['"gatewayService%d": {"httpAddress": "127.0.0.1:%d", "grpcAddress": "127.0.0.1:%d"},'%(x, x, x+100) for x in range(5100, 5132)]))
```
