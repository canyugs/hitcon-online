// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {} from '../input-manager.mjs';

const DOM_ID = 'loading-screen-div';
const DOM_INACTIVE = 'loading-screen--inactive';
const MESSAGE_OFFSET = 150;

const LoadingSet = [
  ['System: Loading Character... (100/100)', 'Done'],
  ['System: Loading Maps... (100/100)', 'Done'],
  ['System: Generating NPCs... (100/100)', 'Done'],
  ['System: Importing hackers... (100/100)', 'Done'],
  ['Hacker Cat: Curious about who is coming...', 'Meow'],
  ['System: Hacker detected!!!', 'Done'],
  ['System: Calling FBI...', 'Done'],
  ['System: Training STAFF...', 'Done'],
  ['System: Booting up HITCON Online.', 'Done'],
  ['FBI: Opening the door...', 'Failed'],
  ['System: Rebooting', ':)'],
];

/**
 *  The logic of loading screen page.
 */
class LoadingScreenPage {
  /**
   * @constructor
   */
  constructor() {
    this.DOM = document.getElementById(DOM_ID);
    this.showMessage(LoadingSet);
    this.cleanMessages(LoadingSet);
    setTimeout(this.typeMessage.bind(this), 4000);
  }

  /**
   * generate DOM for display message;
   * @param {Array} [text1, text2] text to fiil;
   */
  getLineNode([text1, text2]) {
    const line = document.createElement('li');
    const descDiv = document.createElement('div');
    descDiv.classList.add('typewriter');
    const resultDiv = document.createElement('div');
    resultDiv.classList.add('typewriter');
    resultDiv.classList.add('end');
    const descText = document.createTextNode(text1);
    const resultText = document.createTextNode(text2);
    if (text2 === 'Failed') resultDiv.classList.add('warn');
    descDiv.appendChild(descText);
    resultDiv.appendChild(resultText);
    line.appendChild(descDiv);
    line.appendChild(resultDiv);
    return line;
  }

  /*
   *  generate DOM for typing text;
   */
  getTypingNode() {
    const typingNode = document.createElement('span');
    typingNode.setAttribute('id', 'typeText');
    typingNode.classList.add('typing');
    const blinker = document.createElement('span');
    blinker.classList.add('blinker');
    const blinkerText = document.createTextNode(' ');
    blinker.appendChild(blinkerText);
    return [typingNode, blinker];
  }


  /**
   * display message with delay imitate terminal logs;
   * @param {Array} messageSet The messages to show;
   */
  showMessage(messageSet) {
    let offset = 0;
    const getLineNode = this.getLineNode;
    const container = this.DOM.querySelector('.loading-screen-text');
    messageSet.forEach((message) => {
      offset += MESSAGE_OFFSET;
      const time = offset;
      setTimeout(function() {
        container.appendChild(getLineNode(message));
      }, time);
    });
  }

  /**
   * typing message in loading screen;
   */
  typeMessage() {
    const data = [
      {
        typeText: '<span>Hi I\'m Hacker Meow......<br/>hmm... <br/>I mean Hacker Cat, actually<br/><br/>Are you ready to join The World?<br/><br/>Use your skill to help someone in trouble <br/>Solving all challenges<br/>Finding all the secrets</span><br/><br/><span>Let New Adventure begin<br/>.................<br/>.................<br/>.................<br/>.................<br/>.................<br/></span>',
      },
    ];
    // setup dom for typing text
    const container = this.DOM.querySelector('.loading-screen-text');
    const [typingNode, blinker] = this.getTypingNode();
    container.appendChild(typingNode);
    container.appendChild(blinker);

    const allElements = document.getElementsByClassName('typing');
    for (let j = 0; j < allElements.length; j++) {
      const currentElementId = allElements[j].id;
      const currentElementIdContent = data[0][currentElementId];
      let element = document.getElementById(currentElementId);
      let typeText = currentElementIdContent;

      // type code
      let i = 0; let isTag; let text;
      (function type() {
        text = typeText.slice(0, ++i);
        if (text === typeText) {
          // Finished typing.
          // GameClient will call this.close().
          return;
        }
        element.innerHTML = text + `<span class='blinker'>&#32;</span>`;
        const char = text.slice(-1);
        if (char === '<') isTag = true;
        if (char === '>') isTag = false;
        if (isTag) return type();
        setTimeout(type, 30);
      })();
    }
  }

  /**
   *  remove all messages after all message displayed.
   *  @param {Array} messageSet Get array length to trigger cleaning
   */
  cleanMessages(messageSet) {
    const time = (messageSet.length * MESSAGE_OFFSET) + MESSAGE_OFFSET * 13;
    const container = this.DOM.querySelector('.loading-screen-text');
    setTimeout(function() {
      container.textContent = '';
    }, time);
  }

  /*
   * make loading screen disapper
   */
  close() {
    this.DOM.classList.add(DOM_INACTIVE);
  }
}

export default LoadingScreenPage;
