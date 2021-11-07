import fs from 'fs';
import url from 'url';
import path from 'path';

import {mapTransform} from './map.mjs';
import {tilesetTransform} from './assets.mjs';
import {readFileFromJSON, writeFileToJSON} from './utils.mjs';


// Setup path first
const TILED_PROJECT_DIR = '../../../hitcon-cat-adventure/tiled_maps';
const ONLINE_MAP_CONFIG_DIR = '../../../hitcon-cat-adventure/run/map';


const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/maps`);
const tilesetsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/tilesets`);
const fixedsetsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/fixedsets`);
const charactersConfig = readFileFromJSON(`${fixedsetsDir}/characters.json`);
const cellsetsConfig = readFileFromJSON(`${fixedsetsDir}/cellsets.json`);

const mapsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/map2.json`);
const assetsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/assets.json`);
const currentAssetsConfig = readFileFromJSON(assetsConfigPath);

const newMaps = {};
const mapNameList = [];
const tmpLayerMap = {};
const tmpImagesDef = {};
const tilesetSource = {};
const allTilesets = {};
const tilesetDirectory = {};

console.log(`read tilesets from ${tilesetsDir}`);
fs.readdirSync(tilesetsDir).forEach((file, index) => {
  const pathData = path.parse(file);
  const {ext, name} = pathData;
  if (ext === '.json') {
    //console.log(` > add ${file}`);
    const data = readFileFromJSON(`${tilesetsDir}/${file}`);

    // Copy source image to online
    const imageRealSrc = path.join(tilesetsDir, data.image);
    const {ext: destExt} = path.parse(imageRealSrc);
    const imageRealDest = path.resolve(path.join(__dirname, ONLINE_MAP_CONFIG_DIR, `${data.name}${destExt}`));
    fs.copyFileSync(imageRealSrc, imageRealDest);

    // export image and tiles definition
    const prefix = String.fromCharCode('a'.charCodeAt()+index);
    const {imageSrc, tiles} = tilesetTransform(data, prefix);
    tmpLayerMap[name] = tiles;
    tmpImagesDef[imageSrc.name] = imageSrc;
    tilesetDirectory[name] = {tiles: tiles, imageSrc: imageSrc, prefix: prefix};
  }
});


//////////////////////////////////////////

const originalAssets = {
  'G': [
    'base',
    2,
    0,
  ],
  'P': [
    'base',
    3,
    0,
  ],
  'H': [
    'base',
    15,
    1,
  ],
  'O': [
    'base',
    2,
    0,
  ],
  'TV': [
    'base',
    11,
    4,
  ],
};

function getAllTileLayerMap() {
  let res = {};
  for (const n in tmpLayerMap) {
    res = {
      ...res,
      ...tmpLayerMap[n]
    };
  }
  res = {
    ...res,
    ...originalAssets,
  };
  return res;
}

const resultLayerMap = getAllTileLayerMap();

//////////////////////////////////////////


// read data from child maps.
const targetMap = path.join(mapsDir, 'map02');
const {base} = path.parse(targetMap);
const originalCellSets = cellsetsConfig;
const worldName = 'world2';

console.log(`read maps from ${targetMap}`);
fs.readdirSync(targetMap).forEach((file) => {
  const {ext, name:mapName} = path.parse(file);
  if (ext === '.json') {
    //console.log(` > add ${file}`);
    const data = readFileFromJSON(`${targetMap}/${file}`);

    newMaps[mapName] = data;
    mapNameList.push(mapName);
    tilesetSource[mapName] = {};
    const gidRange = [];
    data.tilesets.forEach((tileset) => {
      const {source} = tileset;
      if (source === undefined) {
        console.error('embed tileset unsupport');
      }
      const {name: tilesetName} = path.parse(source);
      // Tileset source for all maps;
      gidRange.push({...tileset, name: tilesetName});
      tilesetSource[mapName]
      tilesetSource[mapName][tilesetName] = tileset;
      allTilesets[tilesetName] = tileset;
    });
    console.log(gidRange);
    gidRange.sort((a, b) => { return a-b; });
    data.gidRange = gidRange;
  }
});

//console.log('tileset source for all maps\n', tilesetSource)
console.log({allTilesets});
function getGidRange(gidRange, gid) {
  let result = undefined;
  for (const r of gidRange) {
    if (r.firstgid > gid) {
      return result;
    }
    result = r;
  }
  return result;
}

function combineSingleLayer(childMaps, layerName) {
  const worldWidth = 200;
  const worldHeight = 100;
  const mapWidth = 40;
  const mapHeight = 50;
  const combinedLayer = [];

  function mapGid(gid, mapName, idx) {
    if (layerName === 'wall') return gid;
    if (layerName === 'jitsi') return gid;

    const r = getGidRange(childMaps[mapName].gidRange, gid);
    if (typeof r === 'undefined') return null;
    const cell = tilesetDirectory[r.name].prefix + (gid-(r.firstgid));

    if (!(cell in resultLayerMap)) {
      console.warn("AABBCC", cell, mapName, layerName, idx, gid, r);
      return null;
    }

    return cell;
  }

  function fetchJitsiLayer(targetLayer, startIdx, endIdx, mapName) {
    let result = [];
    for (let idx = startIdx; idx < endIdx; idx++) result.push(idx);

    if (targetLayer === undefined) {
      // no jitsi here.
      console.warn(`No jitsi layer in ${mapName}`);
      return result.map((idx) => null);
    }

    result = result.map((idx) => {
      const data = targetLayer.layers.filter((l) => {
        return typeof l.data[idx] === "number" && l.data[idx] !== 0
      }).map((l) => {
        return l.name;
      });
      if (data.length === 0) {
        // No jitsi here.
        return null;
      }
      if (data.length !== 1) {
        console.warn(`Multiple jitsi value on ${mapName} - ${idx}`, data);
      }
      return data[0];
    });
    return result;
  }

  // map01 ~ 05
  for (let row = 0; row < mapHeight; row++) {
    const startIdx = mapWidth * row;
    const endIdx = (mapWidth * row) + mapWidth;
    for (let idx = 1; idx < 6; idx++) {
      const mapName = `${base}-0${idx}`;
      const targetLayer = childMaps[mapName].layers
        .filter((layer) => layer.name.toLowerCase() === layerName)[0];
      if (targetLayer === undefined) return null;
      let data;
      if (layerName === 'jitsi') data = fetchJitsiLayer(targetLayer, startIdx, endIdx, mapName);
      else data = targetLayer.data.slice(startIdx, endIdx);

      const mappedData = data.map((gid, idx) => {
        return mapGid(gid, mapName, idx);
      });
      combinedLayer.push(...mappedData);
    }
  }

  // map06 ~ 10
  for (let row = 0; row < mapHeight; row++) {
    const startIdx = mapWidth * row;
    const endIdx = (mapWidth * row) + mapWidth;
    for (let idx = 6; idx < 11; idx++) {
      const numStr = idx < 10 ? `0${idx}` : idx;
      const mapName = `${base}-${numStr}`;
      const targetLayer = childMaps[mapName].layers
        .filter((layer) => layer.name.toLowerCase() === layerName)[0];

      let data;
      if (layerName === 'jitsi') data = fetchJitsiLayer(targetLayer, startIdx, endIdx, mapName);
      else data = targetLayer.data.slice(startIdx, endIdx);

      const mappedData = data.map((gid, idx) => {
        return mapGid(gid, mapName, idx);
      });
      combinedLayer.push(...mappedData);
    }
  }
  const adjLayer = combinedLayer.map((gid) => {
    return gid;
  });
  return adjLayer;
}

function combineGroupLayer(childMaps, layerName) {
  const worldWidth = 200;
  const worldHeight = 100;
  const mapWidth = 40;
  const mapHeight = 50;
  const combinedLayer = [];
  // TODO
  return combinedLayer;
}


const layerTemplate = {
  width: 200,
  height: 100,
  type: 'tilelayer',
  name: 'template',
  x: 0,
  y: 0,
  data: null
}


const mapDataTemplate = {
  width: 200,
  height: 100,
  layers: [
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'ground'),
      name: 'ground',
    },
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'background'),
      name: 'background',
    },
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'foreground'),
      name: 'object',
    },
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'wall'),
      name: 'wall',
    },
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'jitsi'),
      name: 'jitsi',
    },
  ],
  tilesets: [],
  type: 'map',
};

// To covert mapData to fit canvas;
const {mapData, tilesetSrc} = mapTransform(mapDataTemplate);

const originalImages = [
  {
    'name': 'base',
    'url': '/static/run/map/base.png',
    'gridWidth': 32,
    'gridHeight': 32,
  },
  {
    'name': 'char1img',
    'url': '/static/run/map/su1_Student_male_01.png',
    'gridWidth': 32,
    'gridHeight': 32,
  },
];

originalImages.forEach((img) => {
  tmpImagesDef[img.name] = img;
});



const newMapsConfig = {};
newMapsConfig[worldName] = {
  startX: 0,
  startY: 0,
  width: 200,
  height: 100,
  ...mapData,
  cellSets: originalCellSets,
};

writeFileToJSON(mapsConfigPath, newMapsConfig);


const newAssetsConfig = {
  layerMap: {
    ground: {},
    background: {},
    foreground: {},
  },
  images: [],
  characters: charactersConfig,
};

const newImageDef = [];
Object.entries(tmpImagesDef).forEach(([name, image]) => {
  newImageDef.push(image);
});

// TODO defemine Which tileset should be add (like tmpLayerMap['Exterior_w41'] )
newAssetsConfig.images = newImageDef;
newAssetsConfig.layerMap.ground = getAllTileLayerMap();
newAssetsConfig.layerMap.background = getAllTileLayerMap();
newAssetsConfig.layerMap.object = getAllTileLayerMap();
newAssetsConfig.layerMap.bombmanObstacle = {
      "O": [
        "base",
        6,
        12
      ]
    };
newAssetsConfig.layerMap.bombmanHasBomb = {
      "B": [
        "base",
        15,
        14
      ]
    };


writeFileToJSON(assetsConfigPath, newAssetsConfig);


