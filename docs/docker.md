# Docker

This documentation is about how to run hitcon-online in Docker.
In short:
```
cd docker
docker-compose up -d
```

Currently there are four containers, for `redis`, `nginx` (for reverse proxy and load balancing), `online` (main container for hitcon-online), and `setup` (for the generation of the nginx.conf file). The default config file for hitcon-online is `production.json`. Make sure that multiprocess mode is enabled and `publicAddress` is assigned.

By default, only port 80 (from Nginx) is exposed to the host. One can access hitcon-online through `online.hitcon.org`. This is a temporary location, we might not use it in production.

Also, modify the `hosts` file so that the temporary address works.
```
127.0.0.1       online.hitcon.org
```