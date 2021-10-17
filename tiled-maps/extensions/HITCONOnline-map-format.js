// This example script for Tiled App
// TODO change content to match our config
var customMapFormat = {
    name: "HITCON Onine map files",
    extension: "json",

    write: function(map, fileName) {
        var m = {
            startX: 0,
            startY: 0,
            width: map.width,
            height: map.height,
            layers: [],
            cellSets: [],
        };

        for (var i = 0; i < map.layerCount; ++i) {
            var layer = map.layerAt(i);
            if (layer.isTileLayer) {
                var rows = [];
                for (y = 0; y < layer.height; ++y) {
                    var row = [];
                    for (x = 0; x < layer.width; ++x)
                        row.push(layer.cellAt(x, y).tileId);
                    rows.push(row);
                }
                m.push(rows);
            }
        }

        var file = new TextFile(fileName, TextFile.WriteOnly);
        file.write(JSON.stringify(m));
        file.commit();
    },
};

tiled.registerMapFormat("hitcon-map", customMapFormat);
