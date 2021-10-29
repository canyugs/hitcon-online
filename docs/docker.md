# Docker

This documentation is about how to run hitcon-online in Docker.
In short:
```
cd docker
docker-compose up -d
```

Currently there are three containers, for `redis`, `nginx` (for reverse proxy and load balancing), and `online` (main container for hitcon-online). Make sure that multiprocess mode is enabled and `publicAddress` is assigned.

The nginx config file *will not* be automatic generated. You have to do `python3 generate-nginx-conf.py run_dir [config name]` to generate one, and restart the nginx container to take effect.

By default, only port 80 (from Nginx) is exposed to the host. One can access hitcon-online through `online.hitcon.org`. This is a temporary location, we might not use it in production.

Also, modify the `hosts` file so that the temporary address works.
```
127.0.0.1       online.hitcon.org
```