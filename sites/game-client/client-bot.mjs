// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Use a bot to do the stress test
 */
class ClientBot {
  /**
   * Create a new client bot
   * @constructor
   * @param {MapRender} mapRender - The MapRender object for retrieving the
   * canvas object for registering input events on it and mapping the
   * coordinates in the event to the map coordinate.
   */
    constructor(mapRenderer) {
        this.keyMap = {'ArrowUp': 'ArrowUp', 'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight', 'ArrowDown': 'ArrowDown'};
        this.keys = Object.keys(this.keyMap);
        mapRenderer.canvas.click(); // Focus on the canvas to press keys
        setInterval(() => {
            this.pressKey(mapRenderer.canvas, 1000, this.keys[Math.floor(Math.random() * this.keys.length)]);
        }, 2000);
    }

  /**
   * Simulate users to press the key
   * @param {target} DOMElement - A DOMElement to be triggered
   * @param {duration} duration - The duration of pressing the key
   * @param {key} key - The keyboard event
   */
    pressKey(target, duration, key) {
        target.dispatchEvent(new KeyboardEvent('keydown', {key: key, code: this.keyMap[key], bubbles: true}));
        setTimeout(() => {
            target.dispatchEvent(new KeyboardEvent('keyup', {key: key, code: this.keyMap[key], bubbles: true}));
        }, duration);
    }

}

export default ClientBot;
