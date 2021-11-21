// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import JitsiHandler from './jitsi.mjs';
import ToolbarButton from '/static/sites/game-client/ui/toolbar-button.mjs';
import Overlay from '/static/sites/game-client/ui/overlay.mjs';
import OverlayPosition from '/static/sites/game-client/ui/overlay-position.mjs';
import Modal from '/static/sites/game-client/ui/modal.mjs';

const JITSI_DIV = 'jitsi-container';
const JITSI_MODAL_DIV = 'jitsi-modal';

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

class JitsiModal extends Modal {
  constructor(mainUI, client) {
    const dom = document.getElementById(JITSI_MODAL_DIV);
    super(mainUI, dom);
    this.client = client;
    $("#jitsi-modal-close-btn").click(() => {
      this.hide();
    });
  }

  onPostShow() {
    this.setSize('40vw', '70vh');
    this.setPosition('25vw', '10vh');
  }
}

/**
 * This is a temporary overlay to put the Jitsi into fullscreen.
 */
class JitsiFullscreenOverlay extends Overlay {
  /**
   * Create the overlay, and add an event listener to put the Jitsi video into fullscreen when clicked.
   * @constructor
   * @param mainUI - main UI
   * @param jitsiObj - The Jitsi object.
   */
  constructor(mainUI, jitsiObj) {
    const dom = document.getElementById('jitsi-fullscreen-overlay');
    super(mainUI, dom);
    this.hide();
    this.hasFullscreen = false;
    this.jitsiObj = jitsiObj;

    const self = this;
    $('#jitsi-remote-container').on('click', '.jitsi-user-container', function() {
      if (self.hasFullscreen) return;
      self.hasFullscreen = true;
      const focusedParticipantId = $(this).attr('data-id'); // get participant id
      $(this).find('video').eq(0).appendTo('#jitsi-fullscreen-overlay'); // move the video element to #jitsi-fullscreen-overlay
      self.show(OverlayPosition.LEFT_BOTTOM); // show the overlay

      // try to select the participant, so that the video quality would be better.
      try {
        self.jitsiObj.room.selectParticipant(focusedParticipantId);
      } catch (e) {
        console.error("Failed to select the participant", e);
      }

      mainUI.enterFocusMode(self, OverlayPosition.LEFT_BOTTOM, () => {
        // move the video element back to where it should be
        $('#jitsi-fullscreen-overlay > video').appendTo(`#jitsi-${focusedParticipantId}-container > .jitsi-user-video`);
        self.hide();// hide the overlay
        self.hasFullscreen = false;
        self.jitsiObj.room.selectParticipant(null); // clear participant selection.
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
    this.currentMeeting = undefined;

    this.isMicrophoneOn = false;
    this.isCameraOn = false;
    this.isScreenSharingOn = false;

    this.audioDevice = null;
    this.videoDevice = null;

    this.jitsiObj = new JitsiHandler(
      this.getDevices,
      this.setSettingDeviceOptions.bind(this),
      this.broadcastParticipantId.bind(this)
    );
  }

  async gameStart() {
    this.container = new JitsiContainer(this.helper.mainUI);
    this.container.hide();

    this.overlay = new JitsiFullscreenOverlay(this.helper.mainUI, this.jitsiObj);
    
    this.modal = new JitsiModal(this.helper.mainUI, this);
    this.modalButton = document.querySelector('#jitsi-others-btn');
    this.modalButton.addEventListener('click', ()=>{
      this.modal.show();
    })

    // Microphone button
    this.microphoneButton = new ToolbarButton('/static/extensions/jitsi/common/icons/microphone-off.svg', false);
    this.microphoneButton.registerDom(document.getElementById('jitsi-microphone'));
    this.microphoneButton.registerOnClick(() => {
      if (this.isMicrophoneOn) {
        this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-off.svg');
        this.isMicrophoneOn = false;
        if (this.jitsiObj) {
          this.jitsiObj.isMuted.audio = false;
          this.jitsiObj.mute('audio');
        }
      } else {
        this.microphoneButton.changeIcon('/static/extensions/jitsi/common/icons/microphone-on.svg');
        this.isMicrophoneOn = true;
        if (this.jitsiObj) {
          this.jitsiObj.isMuted.audio = true;
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
          this.jitsiObj.isMuted.video = false;
          this.jitsiObj.mute('video');
        }
      } else {
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-on.svg');
        this.isCameraOn = true;
        if (this.jitsiObj) {
          this.jitsiObj.isMuted.video = true;
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
          this.jitsiObj.createLocalTrack('video');
        }
      } else {
        this.screenButton.changeIcon('/static/extensions/jitsi/common/icons/screen-on.svg');
        this.isScreenSharingOn = true;

        // webcam would be disabled when screen sharing is on.
        this.cameraButton.hide();
        this.isCameraOn = false;
        this.cameraButton.changeIcon('/static/extensions/jitsi/common/icons/camera-off.svg');

        if (this.jitsiObj) {
          this.jitsiObj.isMuted.video = true;
          this.jitsiObj.isWebcam = false;
          this.jitsiObj.createLocalTrack('desktop');
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
          this.jitsiObj.createLocalTrack('video');
        }
        this.videoDevice = value;
      }, 0);
      this.settingTab.addDropdown('device', 'audio', '音訊輸入', (value) => {
        console.log('device audio', value);
        if (this.audioDevice !== value && this.jitsiObj) {
          this.jitsiObj.createLocalTrack('audio');
        }
        this.audioDevice = value;
      }, 10);
    }

    JitsiHandler.updateDeviceList(this.setSettingDeviceOptions.bind(this));
  }

  /**
   * Start the Jitsi Meeeting
   */
  async startMeeting(meetingName, realMeetingName, password, connectionInfo) {
    // if this.jitsiObj.isInMeeting is set, the previous meeting has not yet ended.
    // TODO: Probably use Promise instead.
    // We may need to handle the case that `startMeeting` is called multiple times.
    while (this.jitsiObj.isInMeeting) {
      await new Promise(r => setTimeout(r, 1000));
    }

    this.jitsiObj.connect(
      realMeetingName,
      password,
      this.helper.gameClient.playerInfo.displayName,
      connectionInfo
    );

    this.jitsiObj.isMuted.audio = !this.isMicrophoneOn;
    this.jitsiObj.isMuted.video = !this.isCameraOn;

    this.currentMeeting = meetingName;
    this.container.show();
  }

  /**
   * Stop the Jitsi Meeting.
   */
  async stopMeeting() {
    if (this.jitsiObj) {
      this.container.hide();
      await this.jitsiObj.unload();
      this.currentMeeting = undefined;

      // Set screen sharing to false.
      this.screenButton.changeIcon('/static/extensions/jitsi/common/icons/screen-off.svg');
      this.isScreenSharingOn = false;
      this.cameraButton.show();
    }
  }

  /**
   * Synchronize the state of Jitsi Meeting to the specified meeting.
   */
  async updateMeeting(meetingName) {
    if (typeof meetingName !== 'string') {
      if (this.jitsiObj.isInMeeting) {
        await this.stopMeeting();
      }
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
    let connectionInfo = obj.connectionInfo;

    // Join meeting
    this.startMeeting(meetingName, realMeetingName, password, connectionInfo);
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
   * Update the list of dropdown options. This is called when Jitsi detect new input devices.
   * @param {string} deviceType - The type of device. "audioinput", "videoinput" or "audiooutput"
   * @param {Array} deviceList - The list of devices.
   * @param {string} currentDevice - The selected option.
   */
  setSettingDeviceOptions(deviceType, deviceList, currentDevice) {
    if (this.settingTab) {
      this.settingTab.updateDropdownOptions('device', deviceType, deviceList, currentDevice);
    }
  }

  /**
   * Notify the standalone of the player's participant ID on Jitsi.
   * @param participantId The player's participant ID on Jitsi.
   */
  async broadcastParticipantId(participantId) {
    return await this.helper.callC2sAPI(null, 'updateIdMapping', this.helper.defaultTimeout, {
      'participantId': participantId,
      'meetingName': this.currentMeeting
    });
  }

  /**
   * Notify the Jitsi Handler to update id mapping and remove the dangling user.
   * @param playerIdToParticipantIdMapping The player ID to Participant ID mapping.
   */
  async s2c_updateIdMappingAndRemoveDanglingUser(playerIdToParticipantIdMapping) {
    if (this.jitsiObj) {
      this.jitsiObj.updateIdMappingAndRemoveDanglingUser(playerIdToParticipantIdMapping);
    }
    return true;
  }
};

export default Client;
