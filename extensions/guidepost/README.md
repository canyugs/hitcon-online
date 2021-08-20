# Extension - Guidepost
## Description
Used to set guidepost objects onto the canvas.
The config file can be found at [/run/map/watermark/guideposts.json](../../run/map/watermark/guideposts.json)

## Parameters
* assetName: the guidepost asset name being called
* src: path to the asset
* imageRef: image reference
* The following parameter can refer to [CanvasRenderingContext2D.drawImage](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/drawImage) function
    * srcX: sx. the coordinate X in the image to start from
    * srcY: sy. the coordinate Y in the image to start from
    * sWidth: sWidth. the width of image to be used
    * sHeight: sHeight. the height of image to be used
    * dWidth: dWidth. the width of image to be zoomed
    * dHeight: dHeight. the height of image to be zoomed
* MapCoord: Refer to [common/maplib/map.mjs](../../common/maplib/map.mjs)
* position: topleft, midtop, topright, midleft, center, midright, bottomleft, midbottom, bottomright. the position that the image should be aligned
    ```
    * = coordinate you want to align
    
       topleft        midtop       topright
        *----         --*--         ----*
        |   |         |   |         |   |
        |___|         |___|         |___|

       midleft       center         midright
        _____         _____         ____
        |    |       |     |       |    |
        *    |       |  *  |       |    *
        |____|       |_____|       |____|

      bottomleft    midbottom     bottomright
        ____         _____          _____
        |   |       |     |         |    |
        |   |       |     |         |    |
        *___|       |__*__|         |____*
    ```
