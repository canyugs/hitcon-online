# Extension - Guidepost
## Description
Used to set guidepost objects onto the canvas.
The config file can be found at [/run/map/watermark/guideposts.json](../../run/map/watermark/guideposts.json)

## Parameters
* assetName: the guidepost asset name being called
* src: path to the asset
* imageRef: image reference
* The following parameter can refer to [CanvasRenderingContext2D.drawImage](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/drawImagehttps://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/drawImage) function
    * srcX: sx. the coordinate X in the image to start from
    * srcY: sy. the coordinate Y in the image to start from
    * sWidth: sWidth. the width of image to be used
    * sHeight: sHeight. the height of image to be used
    * dWidth: dWidth. the width of image to be zoomed
    * dHeight: dHeight. the height of image to be zoomed
* MapCoord: Refer to [common/maplib/map.mjs](../../common/maplib/map.mjs)
* position: 1~9. the position that the image should be aligned
    ```
    // I did my best

    * = coordinate you want to align
    
    1.            2.            3.
        *----         --*--         ----*
        |   |         |   |         |   |
        |___|         |___|         |___|

    4.            5.            6.
        _____         _____         ____
        |    |       |     |       |    |
        *    |       |  *  |       |    *
        |____|       |_____|       |____|

    7.            8.            9.
        ____         _____          _____
        |   |       |     |         |    |
        |   |       |     |         |    |
        *___|       |__*__|         |____*
    ```
