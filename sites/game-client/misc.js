/**
 * Resize the canvas and other things on window resizing.
 * @param {object} event
 */
function onResize(event) {
  const canvas = document.querySelector('#mapcanvas');
  // TODO: more detailed tweak
  canvas.height = 32 * 15; // 15 tiles
  canvas.width = 32 * 9; // 9 tiles
}

window.addEventListener('resize', onResize);
window.addEventListener('load', onResize);
