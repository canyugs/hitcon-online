// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const UTILPANEL_RADIO_NAME = 'utilpanel';
const UTILPANEL_ID = 'utilpanel';
const UTILPANEL_DIVIDER_ID = 'utilpanel-divider';
const UTILPANEL_CONTAINER_ID = 'utilpanel-content';

class UtilPanelManager {
  /**
   * TODO
   */
  constructor(mainUI) {
    this.mainUI = mainUI;
    this.tabs = {};
    this.currentShowing = null;
    this.containerDOM = document.getElementById(UTILPANEL_CONTAINER_ID);

    $(`#${UTILPANEL_ID}`).on("change", `input[name="${UTILPANEL_RADIO_NAME}"]`, () => {
      this.onPanelChange();
    });
    $(`#${UTILPANEL_DIVIDER_ID}`).on("click", () => {
      this.onDividerClick();
    });
  }

  /**
   * Fired when the divider is clicked. This will toggle the collapsed state.
   */
  onDividerClick() {
    if (this.isCollapsed()) {
      if (this.getSelected() === 'collapse') {
        // We need to select one, so simulate a click.
        $(`input[name="${UTILPANEL_RADIO_NAME}"]:first`).click();
      } else {
        this.uncollapse();
      }
    } else {
      this.collapse();
    }
  }

  /**
   * Return if we're collapsed.
   */
  isCollapsed() {
    return $(`#${UTILPANEL_ID}`).hasClass('collapse');
  }

  /**
   * Return which tab is being selected in the radio button.
   */
  getSelected() {
    let selected = $(`input[name="${UTILPANEL_RADIO_NAME}"]:checked`).val();
    console.log('On UtilPanel change ' + selected);

    if (typeof selected === 'undefined') {
      selected = 'collapse';
    }
    return selected;
  }

  /**
   * This is fired when one of the radio buttons for selecting the tab is
   * clicked.
   */
  onPanelChange() {
    const selected = this.getSelected();

    if (selected === 'collapse') {
      this.collapse()
    } else {
      this.uncollapse();
    }

    console.log(selected);
    console.log(this.tabs[selected]);
    if (selected !== 'collapse' && typeof this.tabs[selected] !== 'undefined') {
      // Evict the container first.
      if (this.currentTab) {
        this.currentTab.onPreHide();
      }
      this.mainUI._evictDOM(this.containerDOM);
      if (this.currentTab) {
        this.currentTab.onPostHide();
      }

      // Put the tab into the display.
      this.tabs[selected].onPreShow();
      this.currentTab = this.tabs[selected];
      this.containerDOM.appendChild(this.currentTab.dom);
      this.currentTab.onPostShow();
    }
  }

  /**
   * This should only be called by UtilPanelTab class.
   * This is used to register a tab in the utilpanel.
   */
  _registerTab(name, tab) {
    console.assert(typeof this.tabs[name] === 'undefined', `Duplicate tab ${name}`);
    this.tabs[name] = tab;
  }

  /**
   * Show the tab given by name.
   */
  show(name) {
    this.uncollapse();
    $(`input[name="${UTILPANEL_RADIO_NAME}"][value="${name}"]`).click();
  }

  /**
   * If we're collapsed, uncollapse. i.e. Show the contents.
   */
  uncollapse() {
    const changed = this.isCollapsed();
    if (this.currentTab && changed) {
      this.currentTab.onPreShow();
    }
    $(`#${UTILPANEL_ID}`).removeClass('collapse');
    if (this.currentTab && changed) {
      this.currentTab.onPostShow();
    }
  }

  /**
   * If we're not collapsed, collapse. i.e. Hide the contents.
   */
  collapse() {
    const changed = !(this.isCollapsed());
    if (this.currentTab && changed) {
      this.currentTab.onPreHide();
    }
    $(`#${UTILPANEL_ID}`).addClass('collapse');
    if (this.currentTab && changed) {
      this.currentTab.onPostHide();
    }
  }
};

export default UtilPanelManager;
