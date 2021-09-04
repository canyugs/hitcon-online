// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import JitsiHandler from './jitsi.mjs';
import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

const JITSI_DIV = 'jitsi-container';

class JitsiOverlay extends Overlay {
  constructor(mainUI) {
    const dom = document.getElementById(JITSI_DIV);
    super(mainUI, dom);
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
  }

  async gameStart() {
    this.overlay = new JitsiOverlay(this.helper.mainUI);
    this.overlay.hide();

    // Microphone button
    this.microphoneButton = new ToolbarButton('/static/extensions/jitsi/common/icons/microphone-off.svg');
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
    this.microphoneButton.hide();

    // Camera button
    this.cameraButton = new ToolbarButton('/static/extensions/jitsi/common/icons/camera-off.svg');
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
    this.cameraButton.hide();
  }

  /**
   * Start the Jitsi Meeeting
   */
  startMeeting(meetingName, password) {
    this.jitsiObj = new JitsiHandler(meetingName, password,
      this.helper.gameClient.playerInfo.displayName);
    this.currentMeeting = meetingName;
    this.overlay.show(OverlayPosition.CENTER_TOP);

    this.isCameraOn = false;
    this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');
    this.cameraButton.show();

    this.isMicrophoneOn = false;
    this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-off.svg');
    this.microphoneButton.show();
  }

  /**
   * Stop the Jitsi Meeting.
   */
  async stopMeeting() {
    this.microphoneButton.hide();
    this.cameraButton.hide();

    if (this.jitsiObj) {
      this.overlay.hide();
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
    let password = await this.helper.callC2sAPI(null, 'getPassword', 5000, {'meetingName': meetingName});
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
