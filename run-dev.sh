#!/bin/bash

pushd $(dirname "${0}") > /dev/null
cd run
yarn node ../services/main/main-server.mjs --gateway-service gatewayServer
popd > /dev/null
