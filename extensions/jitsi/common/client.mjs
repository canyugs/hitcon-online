// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import JitsiHandler from './jitsi.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';

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
 * This is a temporary overlay to put the Jitsi into fullscreen.
 */
class JitsiFullscreenOverlay extends Overlay {
  /**
   * Create the overlay, and add an event listener to put the Jitsi video into fullscreen when clicked.
   * @constructor
   * @param mainUI - main UI
   */
  constructor(mainUI) {
    const dom = document.getElementById('jitsi-fullscreen-overlay');
    super(mainUI, dom);
    this.hide();

    const self = this;
    $('#jitsi-remote-container').on('click', '.jitsi-user-container', function() {
      const focusedParticipantId = $(this).attr('data-id');
      $(this).find('video').eq(0).appendTo('#jitsi-fullscreen-overlay');
      self.show(OverlayPosition.LEFT_BOTTOM);
      mainUI.enterFocusMode(self, OverlayPosition.LEFT_BOTTOM, () => {
        $('#jitsi-fullscreen-overlay > video').appendTo(`#jitsi-${focusedParticipantId}-container > .jitsi-user-video`);
        self.hide();
      });
    });
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
    this.jitsiObj = undefined;
    this.currentMeeting = undefined;

    this.isMicrophoneOn = false;
    this.isCameraOn = false;
    this.isScreenSharingOn = false;

    this.audioDevice = null;
    this.videoDevice = null;
  }

  async gameStart() {
    this.container = new JitsiContainer(this.helper.mainUI);
    this.container.hide();

    this.overlay = new JitsiFullscreenOverlay(this.helper.mainUI);

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
          this.jitsiObj.isWebcam = true;
          this.jitsiObj.createLocalTracks();
        }
      } else {
        this.screenButton.changeIcon('/static/extensions/jitsi/common/icons/screen-on.svg');
        this.isScreenSharingOn = true;

        // webcam would be disabled when screen sharing is on.
        this.cameraButton.hide();
        this.isCameraOn = false;
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');

        if (this.jitsiObj) {
          this.jitsiObj.isWebcam = false;
          this.jitsiObj.createLocalTracks();
        }
      }
    });
    this.screenButton.show();

    /* Audio and video input setting */
    this.settingTab = this.helper.getExtObj('setting')?.tab;
    if (this.settingTab) {
      this.settingTab.addSubsection('general', 'device', '裝置設定', 10);
      this.settingTab.addDropdown('device', 'video', '影像輸入', (value) => {
        console.log('device video', value);
        if (this.videoDevice !== value && this.jitsiObj) {
          this.jitsiObj.createLocalTracks();
        }
        this.videoDevice = value;
      }, 0);
      this.settingTab.addDropdown('device', 'audio', '音訊輸入', (value) => {
        console.log('device audio', value);
        if (this.audioDevice !== value && this.jitsiObj) {
          this.jitsiObj.createLocalTracks();
        }
        this.audioDevice = value;
      }, 10);
    }

    JitsiHandler.updateDeviceList(this.setSettingDeviceOptions.bind(this));
  }

  /**
   * Start the Jitsi Meeeting
   */
  async startMeeting(meetingName, realMeetingName, password) {
    // if this.jitsiObj is set, the previous meeting has not yet ended.
    // TODO: Probably use Promise instead.
    // We may need to handle the case that `startMeeting` is called multiple times.
    while (this.jitsiObj) {
      await new Promise(r => setTimeout(r, 1000));
    }

    this.jitsiObj = new JitsiHandler(realMeetingName, password,
      this.helper.gameClient.playerInfo.displayName, this.getDevices, this.setSettingDeviceOptions.bind(this));
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
    let obj = await this.helper.callC2sAPI(null, 'getPassword', this.helper.defaultTimeout, {'meetingName': meetingName});
    if (obj.error) {
      console.error('Failed to updateMeeting, getPassword: ', obj);
      return;
    }

    let password = obj.password;
    if (!password) {
      password = null;
    }
    let realMeetingName = obj.meetingName;
    if (!realMeetingName) {
      console.warn('Got invalid meeting name from getPassword(): ', realMeetingName, meetingName);
      realMeetingName = meetingName;
    }

    // Join meeting
    this.startMeeting(meetingName, realMeetingName, password);
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

  /*
   * Audio and video input setting
   */
  getDevices(type) {
    if (type === 'video') return this.videoDevice;
    if (type === 'audio') return this.audioDevice;
    return undefined;
  }

  /**
   *
   */
  setSettingDeviceOptions(deviceType, deviceList, currentDevice) {
    if (this.settingTab) {
      this.settingTab.updateDropdownOptions('device', deviceType, deviceList, currentDevice);
    }
  }
};

export default Client;
