import path from 'path';

export function tilesetTransform(tileset) {
  const tiles = {};
  const columnNum = tileset.columns;
  const rowNum = (tileset.imageheight / tileset.tileheight) - 1;
  let index = 1;

  // TODO read properties to set key;
  for (let i = 0; i <= rowNum; i++) {
    for (let j = 0; j < columnNum; j++) {
      tiles[index] = [tileset.name, j, i];
      index += 1;
    }
  }

  const {name, ext} = path.parse(tileset.image);

  const imageSrc = {
    name: tileset.name,
    url: `/static/run/map/${tileset.name}${ext}`,
    gridWidth: tileset.tilewidth,
    gridHeight: tileset.tileheight,
  };

  return {imageSrc, tiles};
}

