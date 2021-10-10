import fs from 'fs';
import path from 'path';

export function readFileFromJSON(srcFile) {
  const dataBuffer = fs.readFileSync(srcFile);
  return JSON.parse(dataBuffer.toString());
}

export function writeFileToJSON(destFile, Data) {
  const {name} = path.parse(destFile);
  fs.writeFileSync(destFile, JSON.stringify(Data, null, 2));
}
