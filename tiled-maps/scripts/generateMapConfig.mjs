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

const mapsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/map.json`);
const assetsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/assets.json`);
const currentAssetsConfig = readFileFromJSON(assetsConfigPath);

const newMaps = {};
const mapNameList = [];
const tmpLayerMap = {};
const tmpImagesDef = {};
const tilesetSource = {};
const allTilesets = {};

console.log(`read tilesets from ${tilesetsDir}`);
fs.readdirSync(tilesetsDir).forEach((file) => {
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
    const {imageSrc, tiles} = tilesetTransform(data);
    tmpLayerMap[name] = tiles;
    tmpImagesDef[imageSrc.name] = imageSrc;
  }
});

// read data from child maps.
const targetMap = path.join(mapsDir, 'map01');
const {base} = path.parse(targetMap);

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
  }
});

//console.log('tileset source for all maps\n', tilesetSource)
console.log({allTilesets});

function combineSingleLayer(childMaps, layerName) {
  const worldWidth = 200;
  const worldHeight = 100;
  const mapWidth = 40;
  const mapHeight = 50;
  const combinedLayer = [];

  // map01 ~ 05
  for (let row = 0; row < mapHeight; row++) {
    const startIdx = mapWidth * row;
    const endIdx = (mapWidth * row) + mapWidth;
    for (let idx = 1; idx < 6; idx++) {
      const mapName = `${base}-0${idx}`;
      tilesetSource[mapName]
      const targetLayer = childMaps[mapName].layers
        .filter((layer) => layer.name.toLowerCase() === layerName)[0];
      const data = targetLayer.data.slice(startIdx, endIdx);
      combinedLayer.push(...data);
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
      const data = targetLayer.data.slice(startIdx, endIdx);
      combinedLayer.push(...data);
    }
  }
  const adjLayer = combinedLayer.map((gid) => {
    let index = 0;

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
      name: 'foreground',
    },
    {
      ...layerTemplate,
      data: combineSingleLayer(newMaps, 'wall'),
      name: 'wall',
    },
//     {
//       ...layerTemplate,
//       data: combineGroupLayer(newMaps, 'jitsi'),
//       name: 'jitsi',
//     },
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

const worldName = 'world1';

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
newAssetsConfig.layerMap.background = {
  ...tmpLayerMap['Exterior_w41'],
  ...originalAssets,
};
newAssetsConfig.layerMap.foreground = {
  ...tmpLayerMap['Exterior_w41'],
  ...originalAssets,
};


writeFileToJSON(assetsConfigPath, newAssetsConfig);


