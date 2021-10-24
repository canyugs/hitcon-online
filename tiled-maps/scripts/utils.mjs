import fs from 'fs';
import path from 'path';

export function readFileFromJSON(srcFile) {
  const dataBuffer = fs.readFileSync(srcFile);
  return JSON.parse(dataBuffer.toString());
}

export function writeFileToJSON(destFile, Data) {
  fs.writeFileSync(destFile, JSON.stringify(Data, null, 2));
}
