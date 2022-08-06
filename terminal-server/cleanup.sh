#!/bin/sh
docker kill $(docker ps -a -q --filter="name=escape_")
