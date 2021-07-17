
#!/bin/bash
pushd $(dirname "${0}") > /dev/null
cd run
yarn node ../services/standalone/standalone-extension.mjs --ext=$1
popd > /dev/null
