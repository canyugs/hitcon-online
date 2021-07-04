// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

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
  }

  async gameStart() {
  }

  /**
   * Start the Jitsi Meeeting
   */
  startMeeting(meetingName) {
    const domain = 'meet.jit.si';
    const options = {
        roomName: meetingName,
        // TODO: Update the size to fit the UI framework.
        width: 290,
        height: 290,
        parentNode: document.querySelector('#meet-iframe'),
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: true,
          startVideoMuted: true
        }
    };
    const api = new JitsiMeetExternalAPI(domain, options);
    this.jitsiObj = api;
    this.currentMeeting = meetingName;
  }

  /**
   * Stop the Jitsi Meeting.
   */
  stopMeeting() {
    if (this.jitsiObj) {
      this.jitsiObj.dispose();
      this.jitsiObj = undefined;
      this.currentMeeting = undefined;
    }
  }

  /**
   * Synchronize the state of Jitsi Meeting to the specified meeting.
   */
  updateMeeting(meetingName) {
    if (!(typeof meetingName === 'string')) {
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
      this.stopMeeting();
    }
    // If we get here, there's no meeting and we should join one.
    this.startMeeting(meetingName);
  }

  /**
   * Called when our location changes.
   */
  onSelfLocationUpdated(loc) {
    const map = this.helper.getMap();
    if (typeof map === 'object') {
      let m = map.getCell('jitsi', loc.mapCoord.x, loc.mapCoord.y);
      this.updateMeeting(m);
    }
  }
};

export default Client;
