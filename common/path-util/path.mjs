// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import path from 'path';

function getConfigPath() {
  if (typeof process.env.NODE_CONFIG_DIR === 'string' && process.env.NODE_CONFIG_DIR !== '') {
    return path.resolve(process.env.NODE_CONFIG_DIR);
  }
  return path.resolve(process.cwd(), 'config');
}

function getRunPath(...append) {
  const res = getConfigPath();
  if (append.length !== 0) {
    return path.resolve(res, '../', ...append);
  }
  return path.resolve(res, '../');
}

const defaultExport = {getConfigPath, getRunPath};
export default defaultExport;
export {getConfigPath, getRunPath};
