#!/bin/bash

pushd $(dirname "${0}") > /dev/null
cd run
yarn node ../services/main/gateway-server.mjs --service-name=$1
popd > /dev/null
