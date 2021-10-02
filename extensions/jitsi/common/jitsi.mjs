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
    this.volumeMeters = {};
    this.participantsInfo = {};
    this.isJoined = false;
    this.room = null;
    this.isWebcam = true; // Is webcam or screen sharing.
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
      openBridgeChannel: 'websocket'
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
   * Create Jitsi connection
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

    this.createLocalTracks();
  }

  /**
   * Create local track. This method would drop all current local tracks.
   * @param isWebcam Whether the video stream should be the webcam or desktop sharing.
   */
  async createLocalTracks(isWebcam = true) {
    if (!isWebcam && !JitsiMeetJS.isDesktopSharingEnabled()) {
      alert('Screen sharing is not enabled.');
    }

    this.isWebcam = isWebcam;

    // Drop the current local tracks.
    try {
      await Promise.all(this.localTracks.map(track => track.dispose()));
    } catch (e) {
      console.error(e);
    }
    this.localTracks = [];
    $('#jitsi-local').empty();

    // Create new local tracks
    JitsiMeetJS.createLocalTracks({
      devices: ['audio', isWebcam ? 'video' : 'desktop']
    })
    .then(this.onLocalTracks.bind(this))
    .catch((e) => {
      if (!isWebcam) {
        // something goes wrong, switch back to video.
        this.createLocalTracks(true);
      }
      console.error(e);
    });
  }

  /**
   * Handles new local tracks.
   * @param {JitsiTrack} tracks Array with JitsiTrack objects
   */
  onLocalTracks(tracks) {
    console.log("onLocalTracks", tracks);
    this.localTracks = tracks;
    for (let i = 0; i < this.localTracks.length; i++) {
      if (this.localTracks[i].getType() !== 'audio') {
        $('#jitsi-local').append(`<video autoplay='1' id='localVideo${i}' class='jitsi-local-video' />`);
        this.localTracks[i].attach($(`#localVideo${i}`)[0]);
      } else {
        $('#jitsi-local').append(`<audio autoplay='1' muted='true' id='localAudio${i}' class='jitsi-audio' />`);
        $('#jitsi-local').append(`<div id="volume-visualizer-local" class="volume-visualizer"></div>`);
        this.setLocalAudioVolumeMeter($(`#volume-visualizer-local`)[0]);
        this.localTracks[i].attach($(`#localAudio${i}`)[0]);
      }

      // All tracks should be disabled by default (except screen sharing), and enabled upon requested.
      if (this.isWebcam || this.localTracks[i].getType() !== 'video') {
        this.localTracks[i].mute();
      }

      if (this.isJoined) {
        this.room.addTrack(this.localTracks[i]);
      }
    }
  }

  /**
   * Handles new remote tracks.
   * @param {JitsiTrack} track JitsiTrack object
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

    if ($(`#jitsi-${participantId}-container`).length === 0) {
      $('#jitsi-remote-container').append(`
        <div class='jitsi-user-container active' id='jitsi-${participantId}-container'>
          <div class='jitsi-user-loading'></div>
          <div class='jitsi-user-video'></div>
          <div class='jitsi-user-audio'></div>
          <div class='jitsi-user-name' id='jitsi-${participantId}-user-name'>${this.participantsInfo[participantId]._displayName}</div>
        </div>
      `);
    }

    if (track.getType() !== 'audio') {
      $(`#jitsi-${participantId}-container > .jitsi-user-video`).append(`
          <video autoplay='1' id='${trackId}' class='jitsi-remote-video'></video>
      `);
    } else {
      $(`#jitsi-${participantId}-container > .jitsi-user-audio`).append(`
          <audio autoplay='1' id='${trackId}' class='jitsi-audio' />
      `);
    }
    track.attach($(`#${trackId}`)[0]);
    if (track.isMuted()) {
      $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
    } else {
      $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
    }
  }

  onRemoteTrackRemove(track) {
    console.log('track remove', track.getId());
    const participantId = track.getParticipantId();
    try {
      track.detach($(`#${participantId}${track.getType()}${track.getId()}`));
    } catch (e) {
      // An error is expected: https://github.com/jitsi/lib-jitsi-meet/issues/1054
      // It seems that we can safely ignore the error.
      // console.error(e);
    }

    $(`#${participantId}${track.getType()}${track.getId()}`).remove();
  }

  /**
   * Handle mute or unmute from the remote track
   * @param {JitsiTrack} track
   */
  onTrackMute(track) {
    console.log(`${track.getType()} - ${track.isMuted()} ${track.getParticipantId()}`);
    const participantId = track.getParticipantId();
    // Check if this is a remote track
    if (participantId && (participantId in this.remoteTracks)) {
      if (track.isMuted()) {
        $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
      } else {
        $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
      }
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
   * This is executed when an user left.
   * @param {Number} id The participant id of the user just left.
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
      $(`#${id}${tracks[i].getType()}${tracks[i].getId()}`).remove();
    }

    $(`#jitsi-${id}-container`).remove();
  }

  /**
   * Update the user's display name.
   * @param {Number} id The participant id.
   * @param {String} displayName The new display name.
   */
  onDisplayNameChanged(id, displayName) {
    $(`#jitsi-${id}-user-name`).text(displayName);
  }

  /**
   * This is called when connection is established successfully
   */
  onConnectionSuccess() {
    this.room = this.connection.initJitsiConference(this.meetingName.toLowerCase(), {e2eping: {pingInterval: -1}});
    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, this.onRemoteTrack.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, this.onRemoteTrackRemove.bind(this));
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

    this.room.on(JitsiMeetJS.events.conference.PARTICIPANT_PROPERTY_CHANGED, this.setRemoteVolumeMeter.bind(this));

    // This is required yet not documented :(
    // https://github.com/jitsi/lib-jitsi-meet/issues/1333
    this.room.setReceiverVideoConstraint(720);
    this.room.setSenderVideoConstraint(720);

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
   * Mute the local track
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
   * Unmute the local track
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
   * @param selected
   */
  changeAudioOutput(selected) {
    JitsiMeetJS.mediaDevices.setAudioOutputDevice(selected.value);
  }

  /**
   * Start the local volume meter.
   * @param volumeVisualizer The element of the volume meter.
   */
  async setLocalAudioVolumeMeter(volumeVisualizer) {
    let volumeCallback;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
      const audioContext = new AudioContext();
      const audioSource = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.minDecibels = -127;
      analyser.maxDecibels = 0;
      analyser.smoothingTimeConstant = 0.4;
      audioSource.connect(analyser);
      const volumes = new Uint8Array(analyser.frequencyBinCount);
      volumeCallback = () => {
        analyser.getByteFrequencyData(volumes);
        const averageVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        volumeVisualizer.style.setProperty(
          '--volume',
          ((averageVolume - 20) * 100 / (analyser.maxDecibels - analyser.minDecibels)) + '%');
        this.room?.setLocalParticipantProperty('volume', this. averageVolume.toString());
      };
    } catch (e) {
      console.error(e);
    }


    this.volumeMeterIntervalId = setInterval(() => {
      try {
        volumeCallback();
      } catch (e) {
        console.error(e);
        clearInterval(this.volumeMeterIntervalId);
      }
    }, 200);
  }

  /**
   * Set the volume meter of the remote participant.
   */
  setRemoteVolumeMeter(user, propertyKey, oldPropertyValue, propertyValue) {
    if (propertyKey !== 'volume') {
      return;
    }

    const element = document.getElementById('volume-visualizer-' + user.getId());
    if (element != null && element.value == '') {
      element.style.setProperty(
        '--volume',
        ((parseFloat(propertyValue) - 20) * 100 / (analyser.maxDecibels - analyser.minDecibels)) + '%');
    }
  }
}
export default JitsiHandler;