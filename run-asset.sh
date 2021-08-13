#!/bin/bash

pushd $(dirname "${0}") > /dev/null
cd run
yarn node ../services/asset/asset-server-launcher.mjs
popd > /dev/null
