// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class JitsiHandler {
  constructor(meetingName, password, userName) {
    this.connection = null;
    this.isVideo = true;
    this.localTracks = [];
    this.remoteTracks = {};
    this.participantsInfo = {};
    this.isJoined = false;
    this.room = null;
    this.meetingName = meetingName;
    this.password = password;
    this.userName = userName;

    this.options = {
      hosts: {
        domain: 'meet.jit.si',
        muc: 'conference.meet.jit.si',
        focus: 'focus.meet.jit.si',
      },
      externalConnectUrl: 'https://meet.jit.si/http-pre-bind',
      serviceUrl: `https://meet.jit.si/http-bind?room=${meetingName}`,
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

      // All tracks should be disabled by default, and enabled upon requested.
      this.localTracks[i].mute();

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
    const participantId = track.getParticipantId();

    if (!this.remoteTracks[participantId]) {
      this.remoteTracks[participantId] = [];
    }
    this.remoteTracks[participantId].push(track);
    const trackId = participantId + track.getType() + track.getId();

    if (track.getType() === 'video') {
      $('#jitsi-remote-container').append(`
        <div id='${track.getId()}'>
          <video autoplay='1' id='${trackId}' class='jitsi-remote-video'></video>
          <p id='${trackId}-text'>${this.participantsInfo[participantId]._displayName}</p>
        </div>
      `);
    } else {
      $('#jitsi-remote-container').append(`
        <div id='${track.getId()}' class='jitsi-audio'>
          <audio autoplay='1' id='${trackId}' />
        </div>
      `);
    }
    track.attach($(`#${trackId}`)[0]);
    if (track.isMuted()) {
      $(`#${track.getId()}`).hide();
    }
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
        tracks[i].detach($(`#${id}${tracks[i].getType()}${tracks[i].getId()}`));
      } catch (e) {
        // An error is expected: https://github.com/jitsi/lib-jitsi-meet/issues/1054
        // It seems that we can safely ignore the error.
        // console.error(e);
      }
      $(`#${tracks[i].getId()}`).remove();
    }
  }

  onDisplayNameChanged(id, displayName) {
    const tracks = this.remoteTracks[id];

    for (let i = 0; i < tracks.length; i++) {
      if (track.getType() === 'video') {
        $(`#${id}${tracks[i].getType()}${tracks[i].getId()}-text`).text(displayName);
      }
    }
  }

  /**
   * That is called when connection is established successfully
   */
  onConnectionSuccess() {
    this.room = this.connection.initJitsiConference(this.meetingName.toLowerCase(), {});
    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, this.onRemoteTrack.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track) => {
      console.log(`track removed: ${track}`);
    });
    this.room.on(
        JitsiMeetJS.events.conference.CONFERENCE_JOINED,
        this.onConferenceJoined.bind(this));
    this.room.on(JitsiMeetJS.events.conference.USER_JOINED, (id, user) => {
      console.log('user joined: ', id, user._displayName);
      this.participantsInfo[id] = user;
      this.remoteTracks[id] = [];
    });
    this.room.on(JitsiMeetJS.events.conference.USER_LEFT, this.onUserLeft.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, this.onTrackMute.bind(this));
    this.room.on(
        JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
        (userID, displayName) => console.log(`${userID} - ${displayName}`));
    this.room.on(
        JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
        (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`));
    this.room.on(
        JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
        () => console.log(`${this.room.getPhoneNumber()} - ${this.room.getPhonePin()}`));
    this.room.setDisplayName(this.userName);
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
   * Handle mute or unmute from the remote track
   * @param {JitsiTrack} track
   */
  onTrackMute(track) {
    console.log(`${track.getType()} - ${track.isMuted()} ${track.getParticipantId()}`);
    // Check if this is a remote track
    if (track.getParticipantId() && (track.getParticipantId() in this.remoteTracks)) {
      if (track.isMuted()) {
        $(`#${track.getId()}`).hide();
      } else {
        $(`#${track.getId()}`).show();
      }
    }
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
   * Mute the track
   * @param {string} type Which type to mute (audio|video)
   */
  async mute(type) {
    for (let i = 0; i < this.localTracks.length; i++) {
      if (this.localTracks[i].getType() === type) {
        this.localTracks[i].mute();
      }
    }
  }

  /**
   * Unmute the track
   * @param {string} type Which type to unmute (audio|video)
   */
  async unmute(type) {
    for (let i = 0; i < this.localTracks.length; i++) {
      if (this.localTracks[i].getType() === type) {
        this.localTracks[i].unmute();
      }
    }
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
