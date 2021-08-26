// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class JitsiHandler {
  constructor(meetingName, password) {
    this.connection = null;
    this.isVideo = true;
    this.localTracks = [];
    this.remoteTracks = {};
    this.isJoined = false;
    this.room = null;
    this.meetingName = meetingName;
    this.password = password;

    this.options = {
      hosts: {
        domain: 'meet.jit.si',
        muc: 'conference.meet.jit.si',
        focus: 'focus.meet.jit.si',
      },
      externalConnectUrl: 'https://meet.jit.si/http-pre-bind',
      serviceUrl: `https://meet.jit.si/http-bind?room=test`,
      websocket: 'wss://meet.jit.si/xmpp-websocket',
      clientNode: 'http://jitsi.org/jitsimeet',
    };

    $(window).bind('beforeunload', this.unload.bind(this));
    $(window).bind('unload', this.unload.bind(this));

    /* Bind functions */
    this.onDeviceListChangedBinded = this.onDeviceListChanged.bind(this);
    this.disconnectBinded = this.disconnect.bind(this);
    this.onConnectionFailedBinded = this.onConnectionFailed.bind(this);
    this.onConnectionSuccessBinded = this.onConnectionSuccess.bind(this);

    /* Establish connection */
    this.connect();
  }

  /**
   *
   */
  connect() {
    JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
    JitsiMeetJS.init({
      disableAudioLevels: true,
    });
    this.connection = new JitsiMeetJS.JitsiConnection(null, null, this.options);

    this.connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        this.onConnectionSuccessBinded);
    this.connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_FAILED,
        this.onConnectionFailedBinded);
    this.connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
        this.disconnectBinded);

    JitsiMeetJS.mediaDevices.addEventListener(
        JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
        this.onDeviceListChangedBinded);

    this.connection.connect();

    JitsiMeetJS.createLocalTracks({devices: ['audio', 'video']})
        .then(this.onLocalTracks.bind(this))
        .catch((e) => {
          console.error(e);
        });
  }

  /**
   * Handles local tracks.
   * @param tracks Array with JitsiTrack objects
   */
  onLocalTracks(tracks) {
    console.log("onLocalTracks", tracks);
    this.localTracks = tracks;
    for (let i = 0; i < this.localTracks.length; i++) {
      console.log(this.localTracks[i].getType());
      if (this.localTracks[i].getType() === 'video') {
        console.log('onLocalTracks insert video');
        $('#jitsi-local').append(`<video autoplay='1' id='localVideo${i}' class='jitsi-local-video' />`);
        this.localTracks[i].attach($(`#localVideo${i}`)[0]);
      } else {
        console.log('onLocalTracks insert audio');
        $('#jitsi-local').append(
            `<audio autoplay='1' muted='true' id='localAudio${i}' class='jitsi-audio' />`);
        this.localTracks[i].attach($(`#localAudio${i}`)[0]);
      }
      if (this.isJoined) {
        this.room.addTrack(this.localTracks[i]);
      }
    }
  }

  /**
   * Handles remote tracks
   * @param track JitsiTrack object
   */
  onRemoteTrack(track) {
    if (track.isLocal()) {
      return;
    }
    const participant = track.getParticipantId();

    if (!this.remoteTracks[participant]) {
      this.remoteTracks[participant] = [];
    }
    const idx = this.remoteTracks[participant].push(track);
    const id = participant + track.getType() + idx;

    if (track.getType() === 'video') {
      $('#jitsi-remote-container').append(
          `<video autoplay='1' id='${id}' class='jitsi-remote-video' />`);
    } else {
      $('#jitsi-remote-container').append(
          `<audio autoplay='1' id='${id}' class='jitsi-audio' />`);
    }
    track.attach($(`#${id}`)[0]);
  }

  /**
   * That is executed when the conference is joined
   */
  onConferenceJoined() {
    console.log('conference joined!');
    this.isJoined = true;
    for (let i = 0; i < this.localTracks.length; i++) {
      this.room.addTrack(this.localTracks[i]);
    }
  }

  /**
   *
   * @param id
   */
  onUserLeft(id) {
    console.log('user left');
    if (!this.remoteTracks[id]) {
      console.log(this.remoteTracks[id], 'remoteTracks not found');
      return;
    }
    const tracks = this.remoteTracks[id];

    for (let i = 0; i < tracks.length; i++) {
      try {
        tracks[i].detach($(`#${id}${tracks[i].getType()}${i+1}`));
      } catch (e) {
        // An error is expected: https://github.com/jitsi/lib-jitsi-meet/issues/1054
        // It seems that we can safely ignore the error.
        // console.error(e);
      }
      $(`#${id}${tracks[i].getType()}${i+1}`).remove();
    }
  }

  /**
   * That is called when connection is established successfully
   */
  onConnectionSuccess() {
    console.log('this.meetingName', this.meetingName.toLowerCase());
    this.room = this.connection.initJitsiConference(this.meetingName.toLowerCase(), {});
    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, this.onRemoteTrack.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track) => {
      console.log(`track removed: ${track}`);
    });
    this.room.on(
        JitsiMeetJS.events.conference.CONFERENCE_JOINED,
        this.onConferenceJoined.bind(this));
    this.room.on(JitsiMeetJS.events.conference.USER_JOINED, (id) => {
      console.log('user joined: ', id);
      this.remoteTracks[id] = [];
    });
    this.room.on(JitsiMeetJS.events.conference.USER_LEFT, this.onUserLeft.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, (track) => {
      console.log(`${track.getType()} - ${track.isMuted()}`);
    });
    this.room.on(
        JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
        (userID, displayName) => console.log(`${userID} - ${displayName}`));
    this.room.on(
        JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
        (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`));
    this.room.on(
        JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
        () => console.log(`${this.room.getPhoneNumber()} - ${this.room.getPhonePin()}`));
    this.room.join(this.password);
  }

  /**
   * This is called when the connection fail.
   */
  onConnectionFailed() {
    console.error('Connection Failed!');
  }

  /**
     * This is called when the connection fail.
     */
  onDeviceListChanged(devices) {
    console.info('current devices', devices);
  }

  /**
   * This is called when we disconnect.
   */
  disconnect() {
    console.log('disconnect!');
    this.connection.removeEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        this.onConnectionSuccessBinded);
    this.connection.removeEventListener(
        JitsiMeetJS.events.connection.CONNECTION_FAILED,
        this.onConnectionFailedBinded);
    this.connection.removeEventListener(
        JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
        this.disconnectBinded);
  }

  /**
   * Leave the room and clean up the connection.
   */
  async unload() {
    if (this.localTracks) {
      for (let i = 0; i < this.localTracks.length; i++) {
        await this.localTracks[i].dispose();
      }
    }

    // We can safely remove all DOMs at this point.
    $('#jitsi-remote-container').empty();
    $('#jitsi-local').empty();

    if (this.room) {
      await this.room.leave();
    }

    if (this.connection) {
      this.connection.disconnect();
    }

    JitsiMeetJS.mediaDevices.removeEventListener(
        JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
        this.onDeviceListChangedBinded);
  }

  /**
   *
   */
  switchVideo() {
    this.isVideo = !this.isVideo;
    if (this.localTracks[1]) {
      this.localTracks[1].dispose();
      this.localTracks.pop();
    }
    JitsiMeetJS.createLocalTracks({
      devices: [this.isVideo ? 'video' : 'desktop'],
    })
        .then((tracks) => {
          this.localTracks.push(tracks[0]);
          this.localTracks[1].addEventListener(
              JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
              () => console.log('local track muted'));
          this.localTracks[1].addEventListener(
              JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED,
              () => console.log('local track stoped'));
          this.localTracks[1].attach($('#localVideo1')[0]);
          this.room.addTrack(this.localTracks[1]);
        })
        .catch((error) => console.log(error));
  }

  /**
   *
   * @param selected
   */
  changeAudioOutput(selected) {
    JitsiMeetJS.mediaDevices.setAudioOutputDevice(selected.value);
  }
}

export default JitsiHandler;
