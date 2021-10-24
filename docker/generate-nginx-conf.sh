#!/bin/sh
if [ "/run/config/production.json" -nt "/etc/nginx/conf.d/default.conf" ]
then
    echo 'Generating config file...'
    apt-get update > /dev/null
    apt-get install --no-install-recommends --no-install-suggests -y python3 > /dev/null

    cd /app/docker/
    python3 generate-nginx-conf.py /etc/nginx/conf.d/default.conf

    apt-get remove --purge --auto-remove -y python3 > /dev/null
    rm -rf /var/lib/apt/lists/*
fi
