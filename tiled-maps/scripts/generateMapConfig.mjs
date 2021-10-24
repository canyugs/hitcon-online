import fs from 'fs';
import url from 'url';
import path from 'path';

import {mapTransform} from './map.mjs';
import {tilesetTransform} from './assets.mjs';
import {readFileFromJSON, writeFileToJSON} from './utils.mjs';

const TILED_PROJECT_DIR = '../../tiled_maps';
const ONLINE_PROJECT_DIR = '../../run/map';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/maps/map01`);
const tilesetsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/tilesets`);

const mapsConfigPath = path.join(__dirname, `${ONLINE_PROJECT_DIR}/map.json`);
const assetsConfigPath = path.join(__dirname, `${ONLINE_PROJECT_DIR}/assets.json`);
const currentAssetsConfig = readFileFromJSON(assetsConfigPath);

const newMaps = {};
const mapNameList = [];
const tmpLayerMap = {};
const tmpImagesDef = {};
const tmpTilesets = {};

console.log(`read tilesets from ${tilesetsDir}`);
fs.readdirSync(tilesetsDir).forEach((file) => {
  const pathData = path.parse(file);
  const {ext, name} = pathData;
  if (ext === '.json') {
    console.log(` > add ${file}`);
    const data = readFileFromJSON(`${tilesetsDir}/${file}`);

    // Copy source image to online
    const imageRealSrc = path.join(tilesetsDir, data.image);
    const {ext: destExt} = path.parse(imageRealSrc);
    const imageRealDest = path.resolve(path.join(__dirname, `${data.name}${destExt}`));
    fs.copyFileSync(imageRealSrc, imageRealDest);

    // export image and tiles definition
    const {imageSrc, tiles} = tilesetTransform(data);
    tmpLayerMap[name] = tiles;
    tmpImagesDef[imageSrc.name] = imageSrc;
  }
});

// TODO read other layer not only 'ground';
// Combine multiple maps to one world
console.log(`read maps from ${mapsDir}`);
fs.readdirSync(mapsDir).forEach((file) => {
  const {ext, name} = path.parse(file);
  if (ext === '.json') {
    console.log(` > add ${file}`);
    const data = readFileFromJSON(`${mapsDir}/${file}`);
    newMaps[name] = data;
    mapNameList.push(name);
    data.tilesets.forEach((tileset) => {
      const {name, ext} = path.parse(tileset.source);
      tmpTilesets[name] = tileset;
    });
  }
});

const worldWidth = 200;
const worldHeight = 100;
const worldTotalCell = worldWidth * worldHeight;
const worldName = 'world1';
const mapWidth = newMaps['map01-01'].width;
const mapHeight = newMaps['map01-01'].height;

const newLayer = [];

// 01 ~ 05
for (let row = 0; row < mapHeight; row++) {
  const startIdx = mapWidth * row;
  const endIdx = (mapWidth * row) + mapWidth;
  for (let idx = 1; idx < 6; idx++) {
    const mapName = `map01-0${idx}`;
    const data = newMaps[mapName].layers[0].data.slice(startIdx, endIdx);
    newLayer.push(...data);
  }
}

// 06 ~ 10
for (let row = 0; row < mapHeight; row++) {
  const startIdx = mapWidth * row;
  const endIdx = (mapWidth * row) + mapWidth;
  for (let idx = 6; idx < 11; idx++) {
    const numStr = idx < 10 ? `0${idx}` : idx;
    const mapName = `map01-${numStr}`;
    const data = newMaps[mapName].layers[0].data.slice(startIdx, endIdx);
    newLayer.push(...data);
  }
}

// TODO support multiple tilesets
const mapDataTemplate = {
  height: worldHeight,
  width: worldWidth,
  layers: [
    {
      data: newLayer,
      height: worldHeight,
      width: worldWidth,
      name: 'ground',
      type: 'tilelayer',
      x: 0,
      y: 0,
    },
  ],
  tilesets: [],
  type: 'map',
};

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

const wallLayer = Array(worldTotalCell).fill(false);
const objectLayer = Array(worldTotalCell).fill(null);

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
  'TV': [
    'base',
    11,
    4,
  ],
};

const originalCellSets = [
  {
    'name': 'bombmanArena1',
    'priority': 1,
    'cells': [
      {
        'x': 2,
        'y': 2,
        'w': 6,
        'h': 6,
      },
    ],
    'layers': {
      'ground': 'H',
      'wall': false,
    },
  },
  {
    'name': 'bombmanObstacles1',
    'priority': 2,
    'cells': [
      {
        'x': 3,
        'y': 5,
        'w': 2,
        'h': 1,
      },
      {
        'x': 6,
        'y': 3,
        'w': 1,
        'h': 1,
      },
    ],
    'layers': {
      'bombmanObstacle': 'O',
      'wall': true,
    },
  },
  {
    'name': 'spawnPoint',
    'cells': [
      {
        'x': 1,
        'y': 1,
        'w': 2,
        'h': 2,
      },
      {
        'x': 5,
        'y': 6,
        'w': 1,
        'h': 1,
      },
    ],
  },
];

const newMapsConfig = {};
newMapsConfig[worldName] = {
  startX: 0,
  startY: 0,
  width: worldWidth,
  height: worldHeight,
  wall: wallLayer,
  object: objectLayer,
  ...mapData,
  cellSets: originalCellSets,
};

writeFileToJSON('./map.json', newMapsConfig);


const newAssetsConfig = {
  layerMap: {
    ground: {},
    wall: {},
    object: {},
  },
  images: [],
  characters: {
    'char1': {
      'D': [
        'char1img',
        1,
        0,
      ],
      'DR': [
        'char1img',
        0,
        0,
      ],
      'DL': [
        'char1img',
        2,
        0,
      ],
      'L': [
        'char1img',
        1,
        1,
      ],
      'LR': [
        'char1img',
        0,
        1,
      ],
      'LL': [
        'char1img',
        2,
        1,
      ],
      'R': [
        'char1img',
        1,
        2,
      ],
      'RR': [
        'char1img',
        0,
        2,
      ],
      'RL': [
        'char1img',
        2,
        2,
      ],
      'U': [
        'char1img',
        1,
        3,
      ],
      'UR': [
        'char1img',
        0,
        3,
      ],
      'UL': [
        'char1img',
        2,
        3,
      ],
    },
  },
};

const newImageDef = [];
Object.entries(tmpImagesDef).forEach(([name, image]) => {
  newImageDef.push(image);
});

// TODO defemine Which tileset should be add (like tmpLayerMap['Exterior_w41'] )
newAssetsConfig.images = newImageDef;
newAssetsConfig.layerMap.ground = {
  ...tmpLayerMap['Exterior_w41'],
  ...originalAssets,
};

newAssetsConfig.layerMap.object = {
  ...tmpLayerMap['Exterior_w41'],
  ...originalAssets,
};

writeFileToJSON('./assets.json', newAssetsConfig);


