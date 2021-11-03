import path from 'path';

export function tilesetTransform(tileset, prefix) {
  const tiles = {};
  const columnNum = tileset.columns;
  const rowNum = (tileset.imageheight / tileset.tileheight) - 1;
  let index = 0;

  // TODO read properties to set key;
  for (let i = 0; i <= rowNum; i++) {
    for (let j = 0; j < columnNum; j++) {
      tiles[prefix+index] = [tileset.name, j, i];
      index += 1;
    }
  }

  const {ext} = path.parse(tileset.image);

  const imageSrc = {
    name: tileset.name,
    url: `/static/run/map/${tileset.name}${ext}`,
    gridWidth: tileset.tilewidth,
    gridHeight: tileset.tileheight,
  };

  return {imageSrc, tiles};
}

