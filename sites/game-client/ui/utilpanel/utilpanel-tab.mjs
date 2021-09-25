// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import UtilPanelButton from './utilpanel-button.mjs';

/**
 * Represents a tab in the util panel.
 *
 * Those who wants to add a tab in the util panel should extend this
 * class and implement the methods.
 */
class UtilPanelTab {
  /**
   * @param dom HTML DOM element.
   */
  constructor(utilPanelManager, dom, name, iconSrc) {
    this.utilPanelManager = utilPanelManager;
    this.dom = dom;
    this.name = name;

    this.utilPanelManager._registerTab(name, this);
    this.button = new UtilPanelButton(this.name, iconSrc);
  }

  /**
   * Show the tab in the util panel.
   */
  show() {
    this.utilPanelManager.show(name);
  }

  /**
   * Collapse the entire utilpanel.
   * Doesn't affected which panel is being selected.
   */
  hide() {
    if (this.utilPanelManager.getSelected() === this.name) {
      this.utilPanelManager.collapse();
    } else {
      console.warn(`Trying to hide utilpanel when we (${this.name}) are not selected.`);
    }
  }

  /**
   * Executes before the overlay is shown.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPreShow() { return true; }

  /**
   * Executes after the overlay is shown.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPostShow() { return true; }

  /**
   * Executes before the overlay is hidden.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPreHide() { return true; }

  /**
   * Executes after the overlay is hidden.
   *
   * This method can be implemented in the derived class if the derived class
   * wishes to handle this event.
   */
  onPostHide() { return true; }
};

export default UtilPanelTab;
