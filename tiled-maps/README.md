# Tiled project for HITCON Online 2021

```
.
├── HITCON-Online.tiled-project
├── extensions
├── maps
├── tilesets
├── scripts
└── tilesets

```

* HITCON-Online.tiled-project
  Tiled project file, can be load by Tiled.

* extensions(not impl yet, maybe unnecessary?)
  This directory is necessary for Tiled, store scripts of custom output format.

* maps
  store map design.

* tilesets
  material for maps.

* scripts
  scripts for update config.

## Usage
* update config in /run/map (map.json and assets.json) from Tiled.
  1. save map and tileset file.
  2. run scripts
    * Terminal: ```node ./scripts/updateConfig.mjs```
    * Tiled App: `Toolbar > File > Commands > updateConfig`
