import fs from 'fs';
import url from 'url';
import path from 'path';

import {mapTransform} from './map.mjs';
import {tilesetTransform} from './assets.mjs';
import {readFileFromJSON, writeFileToJSON} from './utils.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, '../maps');
const tilesetsDir = path.join(__dirname, '../tilesets');
const mapsConfigPath = path.join(__dirname, '../../run/map/map.json');
const assetsConfigPath = path.join(__dirname, '../../run/map/assets.json');

const currentMapsConfig = readFileFromJSON(mapsConfigPath);
const currentAssetsConfig = readFileFromJSON(assetsConfigPath);
const newMaps = {};
const mapNameList = [];
const newAssets = {
  images: [],
  layerMap: {},
};
const tmpLayerMap = {};

console.log('read maps...');
fs.readdirSync(mapsDir).forEach((file) => {
  const {ext, name} = path.parse(file);
  if (ext === '.json') {
    console.log(` > add ${file}`);
    const data = readFileFromJSON(`${mapsDir}/${file}`);
    const {mapData} = mapTransform(data);
    newMaps[name] = mapData;
    mapNameList.push(name);
  }
});

console.log('read tilesets...');
fs.readdirSync(tilesetsDir).forEach((file) => {
  const {ext, name} = path.parse(file);
  if (ext === '.json') {
    console.log(` > add ${file}`);
    const data = readFileFromJSON(`${tilesetsDir}/${file}`);
    const {imageSrc, tiles} = tilesetTransform(data);
    imageSrc.name = name;
    tmpLayerMap[name] = tiles;
    newAssets.images.push(imageSrc);
  }
});


const newMapsConfig = {};
mapNameList.forEach((mapName) => {
  newMapsConfig[mapName] = {};
  newMapsConfig[mapName] = {
    ...currentMapsConfig[mapName],
    ...newMaps[mapName]};
});
writeFileToJSON(mapsConfigPath, newMapsConfig);


const {layerMap: {ground, object}} = currentAssetsConfig;

const newAssetsConfig = {...currentAssetsConfig};
newAssetsConfig.layerMap.ground = {...ground, ...tmpLayerMap['base']};
newAssetsConfig.layerMap.object = {...object, ...tmpLayerMap['base']};
writeFileToJSON(assetsConfigPath, newAssetsConfig);

