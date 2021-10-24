#!/bin/bash

pushd $(dirname "${0}") >/dev/null
cpath=`pwd`
popd >/dev/null

rundir="${1}"
if [[ "${rundir}" != "" ]]; then
  pushd "${rundir}/config" >/dev/null
  rundir=`pwd`
  popd >/dev/null
else
  rundir="${cpath}/run/config"
fi

pushd "${path}" >/dev/null
NODE_CONFIG_DIR="${rundir}" yarn node "${cpath}/services/main/main-server.mjs" --gateway-service gatewayServer
popd >/dev/null
