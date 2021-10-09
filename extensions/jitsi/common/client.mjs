// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import JitsiHandler from './jitsi.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';

const JITSI_DIV = 'jitsi-container';

class JitsiContainer {
  constructor(mainUI) {
    const dom = document.getElementById(JITSI_DIV);
    this.dom = dom;
    this.mainUI = mainUI;

    this.mainUI.addCustomDOM(dom);
  }

  show() {
    this.dom.classList.remove('jitsi-container--inactive');
  }

  hide() {
    this.dom.classList.add('jitsi-container--inactive');
    $('#jitsi-local').html('');
    $('#jitsi-remote-container').html('');
  }
};


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
    this.jitsiObj = undefined;
    this.currentMeeting = undefined;

    this.isMicrophoneOn = false;
    this.isCameraOn = false;
    this.isScreenSharingOn = false;
  }

  async gameStart() {
    this.container = new JitsiContainer(this.helper.mainUI);
    this.container.hide();

    // Microphone button
    this.microphoneButton = new ToolbarButton('/static/extensions/jitsi/common/icons/microphone-off.svg', false);
    this.microphoneButton.registerDom(document.getElementById('jitsi-microphone'));
    this.microphoneButton.registerOnClick(() => {
      if (this.isMicrophoneOn) {
        this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-off.svg');
        this.isMicrophoneOn = false;
        if (this.jitsiObj) {
          this.jitsiObj.mute('audio');
        }
      } else {
        this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-on.svg');
        this.isMicrophoneOn = true;
        if (this.jitsiObj) {
          this.jitsiObj.unmute('audio');
        }
      }
    });
    this.microphoneButton.show();

    // Camera button
    this.cameraButton = new ToolbarButton('/static/extensions/jitsi/common/icons/camera-off.svg', false);
    this.cameraButton.registerDom(document.getElementById('jitsi-camera'));
    this.cameraButton.registerOnClick(() => {
      if (this.isCameraOn) {
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');
        this.isCameraOn = false;
        if (this.jitsiObj) {
          this.jitsiObj.mute('video');
        }
      } else {
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-on.svg');
        this.isCameraOn = true;
        if (this.jitsiObj) {
          this.jitsiObj.unmute('video');
        }
      }
    });
    this.cameraButton.show();

    // Screen sharing button
    this.screenButton = new ToolbarButton('/static/extensions/jitsi/common/icons/screen-off.svg', false);
    this.screenButton.registerDom(document.getElementById('jitsi-screen'));
    this.screenButton.registerOnClick(() => {
      if (this.isScreenSharingOn) {
        this.screenButton.changeIcon('/static/extensions/jitsi/common/icons/screen-off.svg');
        this.isScreenSharingOn = false;

        this.cameraButton.show();

        if (this.jitsiObj) {
          this.jitsiObj.createLocalTracks(true);
        }
      } else {
        this.screenButton.changeIcon('/static/extensions/jitsi/common/icons/screen-on.svg');
        this.isScreenSharingOn = true;

        // webcam would be disabled when screen sharing is on.
        this.cameraButton.hide();
        this.isCameraOn = false;
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');

        if (this.jitsiObj) {
          this.jitsiObj.createLocalTracks(false);
        }
      }
    });
    this.screenButton.show();
  }

  /**
   * Start the Jitsi Meeeting
   */
  async startMeeting(meetingName, password) {
    // if this.jitsiObj is set, the previous meeting has not yet ended.
    while (this.jitsiObj) {
      await new Promise(r => setTimeout(r, 1000));
    }

    this.jitsiObj = new JitsiHandler(meetingName, password,
      this.helper.gameClient.playerInfo.displayName);
    this.currentMeeting = meetingName;
    this.container.show();

    this.isCameraOn = false;
    this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');

    this.isMicrophoneOn = false;
    this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-off.svg');
  }

  /**
   * Stop the Jitsi Meeting.
   */
  async stopMeeting() {
    if (this.jitsiObj) {
      this.container.hide();
      await this.jitsiObj.unload();
      this.jitsiObj = undefined;
      this.currentMeeting = undefined;
    }
  }

  /**
   * Synchronize the state of Jitsi Meeting to the specified meeting.
   */
  async updateMeeting(meetingName) {
    if (typeof meetingName !== 'string') {
      this.stopMeeting();
      return;
    }
    // If we get here, we're requested to join a meeting.
    if (typeof this.currentMeeting === 'string') {
      // There's an active meeting currently.
      if (this.currentMeeting === meetingName) {
        // No change.
        return;
      }
      await this.stopMeeting();
    }
    // If we get here, there's no meeting.
    // Get the password of the meeting
    let password = await this.helper.callC2sAPI(null, 'getPassword', this.helper.defaultTimeout, {'meetingName': meetingName});
    if (!password) {
      password = null;
    }
    // Join meeting
    this.startMeeting(meetingName, password);
  }

  /**
   * Called when our location changes.
   * @param {PlayerSyncMessage} msg - The update message.
   */
  onSelfPlayerUpdate(msg) {
    const map = this.helper.getMap();
    if (typeof map === 'object') {
      let m = map.getCell(msg.mapCoord, 'jitsi');
      this.updateMeeting(m);
    }
  }
};

export default Client;
