# Docker

This documentation is about how to run hitcon-online in Docker.
In short:
```
cd docker
docker-compose up -d
```

Currently there are four containers, for `redis`, `nginx` (for reverse proxy and load balancing), `online` (main container for hitcon-online), and `setup` (for the generation of the nginx.conf file). The default config file for hitcon-online is `production.json`. Make sure that multiprocess mode is enabled and `publicAddresses` are assigned.

By default, only port 80 (from Nginx) is exposed to the host. One can access hitcon-online through `online.hitcon.org` and the gateway service through `gateway.online.hitcon.org`.  These are temporary locations, we might not use these in production.

Also, modify the `hosts` file so that the temporary addresses work.
```
127.0.0.1       online.hitcon.org
127.0.0.1       gateway.online.hitcon.org
```