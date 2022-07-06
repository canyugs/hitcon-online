// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import UtilPanelTab from '/static/sites/game-client/ui/utilpanel/utilpanel-tab.mjs';
import {PlayerSyncMessage} from '../../../common/gamelib/player.mjs';

const SETTING_DIV = 'setting-overlay';
const ICON_SVG = '/static/extensions/setting/common/setting.svg';

class SettingTab extends UtilPanelTab {
  /**
   * @param {MainUI} mainUI
   */
  constructor(mainUI) {
    const dom = document.getElementById(SETTING_DIV);
    super(mainUI.utilPanelManager, dom, 'setting', ICON_SVG);
    this.mainUI = mainUI;
    this.sections = {};
    this.mainDOM = document.getElementById('setting-main');

    document.getElementById('setting-reset').addEventListener('click', () => {
      this.reset();
    });

    document.getElementById('setting-save').addEventListener('click', () => {
      this.save();
    });
  }

  /**
   * @param {string} name
   * @param {string} displayName
   * @param {number} order
   */
  addSection(name, displayName, order) {
    console.assert(!(name in this.sections), 'section name "' + name + '" is not unique within setting modal.');
    this.sections[name] = {};

    const elem = document.createElement('div');
    elem.className = 'setting-section';
    elem.id = 'setting-section-' + name;
    elem.style.order = order.toString();

    const title = document.createElement('div');
    title.className = 'setting-section-title';
    title.innerText = displayName;
    elem.append(title);
    this.mainDOM.append(elem);
  }

  /**
   * @param {string} parentSection
   * @param {string} name - should be unique across all sections and subsections
   * @param {string} displayName
   * @param {number} order - order within section
   */
  addSubsection(parentSection, name, displayName, order) {
    console.assert(!(name in this.sections), 'subsection name "' + name + '" is not unique within setting modal.');
    console.assert(parentSection in this.sections,
      'subsection "' + name + '" is refer to non-exist section "' + parentSection + '".');
    this.sections[name] = {};

    const parentElem = document.getElementById('setting-section-' + parentSection);
    const elem = document.createElement('div');
    elem.className = 'setting-subsection';
    elem.id = 'setting-section-' + name;
    elem.style.order = order.toString();

    const title = document.createElement('div');
    title.className = 'setting-subsection-title';
    title.innerText = displayName;
    elem.append(title);
    parentElem.append(elem);
  }

  /**
   * Traverse though all settings and reset all contents.
   */
  reset() {
    for (const section in this.sections) {
      for (const name in this.sections[section]) {
        const row = this.sections[section][name];
        const elem = document.getElementById('setting-item-' + section + '-' + name);

        elem.value = row.currentValue;
      }
    }
  }

  /**
   * Traverse though all settings and commit the different.
   */
  save() {
    const msg = {};

    for (const section in this.sections) {
      for (const name in this.sections[section]) {
        const row = this.sections[section][name];
        const elem = document.getElementById('setting-item-' + section + '-' + name);
        if ((row.type !== 'switch' && row.currentValue === elem.value) ||
            (row.type === 'switch' && row.currentValue === elem.checked)) {
          continue;
        }

        if (row.type === 'switch') {
          row.saveCallback(elem.checked);
          row.currentValue = elem.checked;
        } else {
          const re = new RegExp(row.validation);
          if (!elem.value.match(re)) {
            console.warn('Input ' + name + ' doesn\'t match RegEx');
          }

          row.saveCallback(elem.value);
          row.currentValue = elem.value;
        }
      }
    }
  }

  /**
   * @param {string} section - name of parent section/subsection
   * @param {string} name - should be unique within section/subsection
   * @param {string} displayName
   * @param {string} value - initial value of input field
   * @param {function} saveCallback
   * @param {number} order - order within section/subsection
   */
  addTextInput(section, name, displayName, value, saveCallback, order) {
    console.assert(section in this.sections,
      'text input "' + name + '" is refer to non-exist section "' + section + '".');
    this.sections[section][name] = {
      name: name,
      displayName: displayName,
      type: 'text',
      currentValue: value,
      saveCallback: saveCallback,
      validation: '',
    };

    const parentElem = document.getElementById('setting-section-' + section);
    const div = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');

    div.className = 'setting-item setting-item-text';
    div.style.order = order.toString();

    label.htmlFor = 'setting-item-' + section + '-' + name;
    label.textContent = displayName;

    input.id = 'setting-item-' + section + '-' + name;
    input.className = 'setting-item-input';
    input.value = value;
    input.addEventListener('change', event => saveCallback(event.target.value));

    div.append(label);
    div.append(input);
    parentElem.append(div);
  }

  /**
   * @param {string} section - name of parent section/subsection
   * @param {string} name - should be unique within section/subsection
   * @param {string} displayName
   * @param {boolean} value - initial state
   * @param {function} saveCallback
   * @param {number} order - order within section/subsection
   */
  addSwitch(section, name, displayName, value, saveCallback, order) {
    console.assert(section in this.sections,
      'switch "' + name + '" is refer to non-exist section "' + section + '".');
    this.sections[section][name] = {
      name: name,
      displayName: displayName,
      type: 'switch',
      currentValue: value,
      saveCallback: saveCallback,
    };

    const parentElem = document.getElementById('setting-section-' + section);
    const div = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');

    div.className = 'setting-item setting-item-switch';
    div.style.order = order.toString();

    label.htmlFor = 'setting-item-' + section + '-' + name;
    label.textContent = displayName;

    input.id = 'setting-item-' + section + '-' + name;
    input.className = 'setting-item-input';
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', event => saveCallback(event.target.checked));

    div.append(label);
    div.append(input);
    parentElem.append(div);
  }

  /**
   * @param {string} section - name of parent section/subsection
   * @param {string} name - should be unique within section/subsection
   * @param {string} displayName
   * @param {function} saveCallback
   * @param {number} order - order within section/subsection
   */
  addDropdown(section, name, displayName, saveCallback, order) {
    console.assert(section in this.sections,
      'dropdown "' + name + '" is refer to non-exist section "' + section + '".');
    this.sections[section][name] = {
      name: name,
      displayName: displayName,
      type: 'dropdown',
      currentValue: '',
      saveCallback: saveCallback,
    };

    const parentElem = document.getElementById('setting-section-' + section);
    const div = document.createElement('div');
    const label = document.createElement('label');
    const select = document.createElement('select');

    div.className = 'setting-item setting-item-dropdown';
    div.style.order = order.toString();

    label.htmlFor = 'setting-item-' + section + '-' + name;
    label.textContent = displayName;

    select.id = 'setting-item-' + section + '-' + name;
    select.className = 'setting-item-input';
    select.addEventListener('change', event => saveCallback(event.target.value));

    div.append(label);
    div.append(select);
    parentElem.append(div);
  }

  /**
   * Replace options in current dropdown
   * @param {string} section
   * @param {string} name
   * @param {Object} options
   * @param {string} value - initial selected value
   */
  updateDropdownOptions(section, name, options, value) {
    console.assert(name in this.sections[section],
      'dropdown "' + name + '" is not exist in section "' + section + '".');
    this.sections[section][name]['options'] = options;

    if (value !== undefined) {
      this.sections[section][name].currentValue = value;
    }

    const select = document.getElementById('setting-item-' + section + '-' + name);
    select.innerHTML = '';
    for (const optName in options) {
      const option = document.createElement('option');
      option.value = optName;
      option.innerText = options[optName];

      if (this.sections[section][name].currentValue === optName) {
        option.selected = true;
      }

      select.append(option);
    }
  }
}


/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class Client {
  /**
   * Create the client side of the extension.
   * @constructor
   * @param {ClientExtensionHelper} helper - An extension helper object for
   * servicing various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
  }

  async gameStart() {
    this.tab = new SettingTab(this.helper.mainUI);
    this.initSetting();
  }

  /**
   * Create basic setting items.
   */
  initSetting() {
    this.tab.addSection('general', '一般設定', 0);
    this.tab.addSubsection('general', 'account', '帳號設定', 0);

    const nickname = this.helper.gameClient.playerInfo.displayName;
    this.tab.addTextInput('account', 'nickname', '暱稱', nickname, (value) => {
      const player = this.helper.gameClient.playerInfo;
      const msg = PlayerSyncMessage.fromObject({
        playerID: player.playerID,
        displayName: value,
      });
      this.helper.gameClient.movementManager.sendPlayerUpdateInternal(msg);
    }, 0);

    this.tab.addSubsection('general', 'canvas_display', '地圖顯示設定', 0);
    this.tab.addSwitch('canvas_display', 'player_name_display', '隱藏使用者名稱', false, (value) => {
      this.helper.mapRenderer.setHidePlayerName(value);
    }, 0);
    this.tab.addSwitch('canvas_display', 'NPC_name_display', '隱藏ＮＰＣ名稱', false, (value) => {
      this.helper.mapRenderer.setHideNPCName(value);
    }, 0);
  }
}

export default Client;
