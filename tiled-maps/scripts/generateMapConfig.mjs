import fs from 'fs';
import url from 'url';
import path from 'path';

import {mapTransform} from './map.mjs';
import {tilesetTransform} from './assets.mjs';
import {readFileFromJSON, writeFileToJSON} from './utils.mjs';
import {combineSingleLayer, mapSingleLayer} from './combiner.mjs';

// Setup path first
function getEnvWithDefault(name, def) {
  if (typeof process.env[name] === 'string') {
    return process.env[name];
  }
  return def;
}

const TILED_PROJECT_DIR = getEnvWithDefault('TILED_IN', '../../../hitcon-cat-adventure/tiled_maps');
const ONLINE_MAP_CONFIG_DIR = getEnvWithDefault('MAP_OUT', '../../../hitcon-cat-adventure/run/map');


const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/maps`);
const tilesetsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/tilesets`);
const fixedsetsDir = path.join(__dirname, `${TILED_PROJECT_DIR}/fixedsets`);
const charactersConfig = readFileFromJSON(`${fixedsetsDir}/characters.json`);
const cellsetsConfig = readFileFromJSON(`${fixedsetsDir}/cellsets.json`);

const mapsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/map.json`);
const assetsConfigPath = path.join(__dirname, `${ONLINE_MAP_CONFIG_DIR}/assets.json`);
const currentAssetsConfig = readFileFromJSON(assetsConfigPath);

const mapNameList = [];
const tmpLayerMap = {};
const tmpImagesDef = {};
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

function createCharImages(srcDir, dstDir) {
  let images = [];
  let characters = {};
  function loadCharDir(isNPC, dir) {
    const charDir = path.resolve(srcDir, dir);
    let dstat = undefined;
    try {
      dstat = fs.statSync(charDir);
    } catch (e) {
      console.warn(`stat on ${charDir} failed`, e);
    }
    if (typeof dstat === 'undefined' || !dstat.isDirectory()) {
      console.warn(`${charDir} doesn't exist`);
      return;
    }
    fs.readdirSync(charDir).forEach((file) => {
      const pathData = path.parse(file);
      const {ext, name} = pathData;
      const dstName = `${name}${ext}`;
      if (ext === '.png' || ext === '.jpg') {
        let charName;
        if (isNPC) {
          charName = `npc_${name}`;
        } else {
          charName = `char_${name}`;
        }
        const imgName = `img_${name}`;
        images.push({
          name: imgName,
          url: `/static/run/map/chars/${dstName}`,
          gridWidth: 32,
          gridHeight: 32
        });
        const c = {
          D:[imgName, 1, 0], DR:[imgName, 0, 0], DL:[imgName, 2, 0],
          L:[imgName, 1, 1], LR:[imgName, 0, 1], LL:[imgName, 2, 1],
          R:[imgName, 1, 2], RR:[imgName, 0, 2], RL:[imgName, 2, 2],
          U:[imgName, 1, 3], UR:[imgName, 0, 3], UL:[imgName, 2, 3],
          isNPC: isNPC
        };
        characters[charName] = c;
        const srcPath = path.resolve(srcDir, dir, file);
        const dstPath = path.resolve(dstDir, 'chars', dstName);
        fs.mkdirSync(path.resolve(dstDir, 'chars'), {recursive: true});
        fs.copyFileSync(srcPath, dstPath);
      }
    });
  }
  loadCharDir(false, 'char_asset');
  loadCharDir(true, 'npc_asset');
  return {images, characters};
}

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

function loadWorld(mapsDir, mapName) {
  // read data from child maps.
  const targetMap = path.join(mapsDir, mapName);
  const {base} = path.parse(targetMap);

  let result = {};
  result.mapData = {};
  result.base = base;
  console.log(`read maps from ${targetMap}`);
  fs.readdirSync(targetMap).forEach((file) => {
    const {ext, name:mapName} = path.parse(file);
    if (ext === '.json') {
      //console.log(` > add ${file}`);
      const data = readFileFromJSON(`${targetMap}/${file}`);

      mapNameList.push(mapName);
      const gidRange = [];
      data.tilesets.forEach((tileset) => {
        const {source} = tileset;
        if (source === undefined) {
          console.error('embed tileset unsupport');
        }
        const {name: tilesetName} = path.parse(source);
        // Tileset source for all maps;
        gidRange.push({...tileset, name: tilesetName});
      });
      gidRange.sort((a, b) => { return a-b; });
      data.gidRange = gidRange;
      result.mapData[mapName] = data;
    }
  });

  return result;
}

function convertWorldCombined(newMaps, tilesetDirectory, resultLayerMap, base, cellsetsConfig) {
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
        data: combineSingleLayer(newMaps, 'ground', tilesetDirectory, resultLayerMap, base),
        name: 'ground',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'background', tilesetDirectory, resultLayerMap, base),
        name: 'background',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'foreground', tilesetDirectory, resultLayerMap, base),
        name: 'object',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'wall', tilesetDirectory, resultLayerMap, base),
        name: 'wall',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'jitsi', tilesetDirectory, resultLayerMap, base),
        name: 'jitsi',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'iframe', tilesetDirectory, resultLayerMap, base),
        name: 'videoIframe',
      },
      {
        ...layerTemplate,
        data: combineSingleLayer(newMaps, 'portal', tilesetDirectory, resultLayerMap, base),
        name: 'portal',
      },
    ],
    tilesets: [],
    type: 'map',
  };

  // To covert mapData to fit canvas;
  const {mapData, tilesetSrc} = mapTransform(mapDataTemplate);

  const result = {
    startX: 0,
    startY: 0,
    width: 200,
    height: 100,
    ...mapData,
    cellSets: cellsetsConfig,
  };

  return result;
}

function convertWorldSingle(newMaps, tilesetDirectory, resultLayerMap, base, cellsetsConfig) {
  const names = Object.keys(newMaps);
  console.assert(names.length === 1, 'Incorrect amount of maps for convertWorldSingle: ', names, newMaps);
  const mapName = names[0];
  const map = newMaps[mapName];

  const layerTemplate = {
    width: map.width,
    height: map.height,
    type: 'tilelayer',
    name: 'template',
    x: 0,
    y: 0,
    data: null
  }

  const dataCount = map.width * map.height;
  const mapDataTemplate = {
    width: map.width,
    height: map.height,
    layers: [
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'ground', tilesetDirectory, resultLayerMap, base),
        name: 'ground',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'background', tilesetDirectory, resultLayerMap, base),
        name: 'background',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'foreground', tilesetDirectory, resultLayerMap, base),
        name: 'object',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'wall', tilesetDirectory, resultLayerMap, base),
        name: 'wall',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'jitsi', tilesetDirectory, resultLayerMap, base),
        name: 'jitsi',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'iframe', tilesetDirectory, resultLayerMap, base),
        name: 'videoIframe',
      },
      {
        ...layerTemplate,
        data: mapSingleLayer(newMaps, mapName, dataCount, 'portal', tilesetDirectory, resultLayerMap, base),
        name: 'portal',
      },
    ],
    tilesets: [],
    type: 'map',
  };

  // To covert mapData to fit canvas;
  const {mapData, tilesetSrc} = mapTransform(mapDataTemplate);

  const result = {
    startX: 0,
    startY: 0,
    width: map.width,
    height: map.height,
    ...mapData,
    cellSets: cellsetsConfig,
  };

  return result;
}

function loadAndConvertWorld(mapName, mapsDir, tilesetDirectory, resultLayerMap, cellsetsConfig, type) {
  let result = loadWorld(mapsDir, mapName);
  if (type === 'combined') {
    return convertWorldCombined(result.mapData, tilesetDirectory, resultLayerMap, result.base, cellsetsConfig);
  }
  if (type === 'single') {
    return convertWorldSingle(result.mapData, tilesetDirectory, resultLayerMap, result.base, cellsetsConfig);
  }
  console.assert(false, 'Unknown type: ', type);
  return undefined;
}

const conversionConfig = [
  {
    srcMapName: 'map01',
    dstMapName: 'world1',
    cellsetsConfig: cellsetsConfig,
    type: 'combined'
  },
  {
    srcMapName: 'map03',
    dstMapName: 'world3',
    cellsetsConfig: [],
    type: 'combined'
  },
  {
    srcMapName: 'map05',
    dstMapName: 'world5',
    cellsetsConfig: [],
    type: 'single'
  },
];

const newMapsConfig = {};

for (const c of conversionConfig) {
  newMapsConfig[c.dstMapName] = loadAndConvertWorld(c.srcMapName, mapsDir, tilesetDirectory, resultLayerMap, c.cellsetsConfig, c.type);
}

writeFileToJSON(mapsConfigPath, newMapsConfig);

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

const charImages = createCharImages(TILED_PROJECT_DIR, ONLINE_MAP_CONFIG_DIR);
charImages.images.forEach((img) => {
  if (img.name in tmpImagesDef) {
    console.warn(`Duplicate img ${img.name}: `, img, tmpImagesDef[img.name]);
  }
  tmpImagesDef[img.name] = img;
});

for (const charName in charImages.characters) {
  const c = charImages.characters[charName];
  if (charName in charactersConfig) {
    console.warn(`Duplicate char ${charName}: `, c, charactersConfig[charName]);
  }
  charactersConfig[charName] = c;
}

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


