#!/bin/bash

pushd $(dirname "${0}") > /dev/null
cd run
yarn node ../services/main/asset-server.mjs --service-name=$1
popd > /dev/null
