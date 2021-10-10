export function mapTransform(map) {
  const mapData = {};

  mapData.width = map.width;
  mapData.height = map.height;

  const cellsets = map.layers.filter((layer) => {
    return (layer.name === 'cellsets' && layer.type === 'group');
  });

  const rootLayers = map.layers.filter((layer) => {
    return (layer.type === 'tilelayer');
  });


  for (let i = 0; i < rootLayers.length; i++) {
    const layer = rootLayers[i];
    const newArray = new Array(map.width * map.height).fill(0);

    // start at last row
    const startIndex = map.width * (map.height - 1);

    // copy row by row
    for (let k = 0; k < layer.data.length; k += map.width) {
      const row = layer.data.slice(k, k + map.width);
      newArray.splice(startIndex - k, map.width, ...row);
    }

    // looking for custom properties to replace value (for jitsi, iframe,...)
    let valueReplace;
    if (layer.properties !== undefined) {
      const valueProp = layer.properties.filter((prop) => {
        return (prop.name === 'value' && prop.type === 'string');
      }).pop();
      if (valueProp !== undefined) valueReplace = valueProp.value;
    }

    // value adjustment to match style with current map.json
    // e.g. wall with bool, empty tile(0) replace with null
    if (layer.name === 'wall') {
      for (let j = 0; j < newArray.length; j++) {
        newArray[j] = Boolean(newArray[j] > 0);
      }
    } else {
      for (let l = 0; l < newArray.length; l++) {
        newArray[l] = newArray[l] === 0 ?
                      null :
                      valueReplace ? valueReplace : newArray[l];
      }
    }
    mapData[layer.name] = newArray;
  }
  return {mapData, tilesetSrc: map.tilesets};
}
