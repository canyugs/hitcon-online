#!/bin/bash

pushd $(dirname "${0}") > /dev/null
cd run
yarn node ./start-all.mjs
popd > /dev/null
