#!/bin/sh
docker stop $(docker ps -a -q --filter="name=escape_")