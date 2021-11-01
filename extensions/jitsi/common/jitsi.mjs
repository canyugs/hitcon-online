// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {createRnnoiseProcessor} from './rnnoise/index.js';

const VOICE_INDICATOR_THRESHOLD = 3;

// constant for exponential smoothing, deltaT = 0.1s, fc = 1/30 Hz
const ALPHA = 0.0205;

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class JitsiHandler {
  constructor(meetingName, password, userName, getDevices, setSettingDeviceOptions) {
    this.connection = null;
    this.isVideo = true;
    this.localTracks = [];
    this.remoteTracks = {};
    this.volumeMeters = {};
    this.participantsInfo = {};
    this.participantSounds = {};
    this.participantSmoothedSounds = {};
    this.isJoined = false;
    this.room = null;
    this.isWebcam = true; // Is webcam or screen sharing.
    this.meetingName = meetingName;
    this.password = password;
    this.userName = userName;
    this.getDevices = getDevices;
    this.setSettingDeviceOptions = setSettingDeviceOptions;

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
    this.disconnectBinded = this.disconnect.bind(this);
    this.onConnectionFailedBinded = this.onConnectionFailed.bind(this);
    this.onConnectionSuccessBinded = this.onConnectionSuccess.bind(this);
    this.updateDeviceListBinded = () => {
      JitsiHandler.updateDeviceList(this.setSettingDeviceOptions);
    };

    /* Sort the jitsi screens periodically */
    this.updateSmoothedSoundInterval = setInterval(this.updateSmoothedSound.bind(this), 100);
    this.sortScreensInterval = setInterval(this.sortScreens.bind(this), 2500);

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
        this.updateDeviceListBinded);

    this.connection.connect();

    this.createLocalTracks();
  }

  /**
   * Create local track. This method would drop all current local tracks.
   */
  async createLocalTracks() {
    if (!this.isWebcam && !JitsiMeetJS.isDesktopSharingEnabled()) {
      alert('Screen sharing is not enabled.');
    }

    // Drop the current local tracks.
    try {
      await Promise.all(this.localTracks.map(track => track.dispose()));
    } catch (e) {
      console.error('Failed to drop current local tracks: ', e);
    }

    this.localTracks = [];
    $('#jitsi-local').empty();

    // Create new local tracks
    try {
      const tracks = await JitsiMeetJS.createLocalTracks({
        devices: ['audio', this.isWebcam ? 'video' : 'desktop'],
        cameraDeviceId: this.getDevices('video'),
        micDeviceId: this.getDevices('audio')
      });
      await this.onLocalTracks(tracks);
    } catch (e) {
      console.error('Failed to create local tracks: ', e);
      // if (!this.isWebcam) {
      //   // something goes wrong, switch back to video.
      //   console.warning('Fall back to video');
      //   try {
      //     this.isWebcam = true;
      //     this.createLocalTracks();
      //   } catch (e) {
      //     console.error('Fall back to video failed: ', e);
      //   }
      // }
    }
  }

  /**
   * Handles new local tracks.
   * @param {JitsiTrack} tracks Array with JitsiTrack objects
   */
  async onLocalTracks(tracks) {
    console.log("onLocalTracks", tracks);

    if ($('#jitsi-local').is(':empty')) {
      $('#jitsi-local').append(`
        <div class='jitsi-user-loading'></div>
        <div class='jitsi-user-video'></div>
        <div class='jitsi-user-audio'></div>
        <div class='jitsi-user-name' id='jitsi-local-user-name'></div>
      `);
    }

    this.localTracks = tracks;
    for (const track of tracks) {
      const trackId = 'jitsi-local-track-' + track.getType();
      if (track.getType() === 'video') {
        $('#jitsi-local > .jitsi-user-video').append(`<video autoplay='1' id='${trackId}' class='jitsi-local-video' />`);
        track.attach($(`#${trackId}`)[0]);
      } else if (track.getType() === 'audio') {
        $('#jitsi-local > .jitsi-user-audio').append(`<audio autoplay='1' muted='true' id='${trackId}' class='jitsi-audio' />`);
        track.attach($(`#${trackId}`)[0]);
      } else {
        console.error('Unknown track type:', track.getType());
        continue;
      }

      // All tracks should be disabled by default (except screen sharing), and enabled upon requested.
      if (this.isWebcam || track.getType() !== 'video') {
        track.mute();
      }

      // Add mute overlay
      if (this.isWebcam || track.getType() !== 'video') {
        $(`#jitsi-local > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
        $(`#${trackId}`).css('display', 'none');
      } else {
        $(`#jitsi-local > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
      }

      if (track.getType() === 'audio') {
        JitsiMeetJS.createTrackVADEmitter(track.getDeviceId(), 4096, await createRnnoiseProcessor());
      }

      if (this.isJoined) {
        this.room.addTrack(track);
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
        <div class='jitsi-user-container active' id='jitsi-${participantId}-container' data-id='${participantId}'>
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
      $(`#${participantId}${track.getType()}${track.getId()}`).css('display', 'none');
    } else {
      $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
    }
  }

  onRemoteTrackRemove(track) {
    if (track.getParticipantId() === null) return;

    const trackId = `${track.getParticipantId()}${track.getType()}${track.getId()}`;
    try {
      track.detach($(`#${trackId}`));
    } catch (e) {
      // An error is expected: https://github.com/jitsi/lib-jitsi-meet/issues/1054
      // It seems that we can safely ignore the error.
      // console.error(e);
    }

    $(`#${trackId}`).remove();
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
        $(`#${track.getParticipantId()}${track.getType()}${track.getId()}`).css('display', 'none');
      } else {
        $(`#jitsi-${participantId}-container > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
        if (track.getType() === 'video') {
          $(`#${track.getParticipantId()}${track.getType()}${track.getId()}`).css('display', 'block');
        }
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
    $('#jitsi-local').addClass('active');
    $('#jitsi-local-user-name').text(this.userName);
    this.setLocalAudioVolumeMeter();
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
    delete this.participantsInfo[id];
    delete this.participantSounds[id];
    delete this.participantSmoothedSounds[id];
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
    this.room = this.connection.initJitsiConference(
      this.meetingName.toLowerCase(),
      {
        e2eping: {
          pingInterval: -1
        }
      }
    );
    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, this.onRemoteTrack.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, this.onRemoteTrackRemove.bind(this));
    this.room.on(
        JitsiMeetJS.events.conference.CONFERENCE_JOINED,
        this.onConferenceJoined.bind(this));
    this.room.on(JitsiMeetJS.events.conference.USER_JOINED, (id, user) => {
      console.log('user joined: ', id, user._displayName);
      this.participantsInfo[id] = user;
      this.participantSounds[id] = 0;
      this.participantSmoothedSounds[id] = 0;
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
   * Update the list of media.
   */
  static updateDeviceList(setSettingDeviceOptions) {
    if (!JitsiMeetJS.mediaDevices.isDeviceListAvailable() || !JitsiMeetJS.mediaDevices.isDeviceChangeAvailable('input')) {
      console.error('cannot change input', JitsiMeetJS.mediaDevices.isDeviceListAvailable(), JitsiMeetJS.mediaDevices.isDeviceChangeAvailable('input'));
      return;
    }

    for (const deviceType of ['video', 'audio']) {
      JitsiMeetJS.mediaDevices.enumerateDevices((devices) => {
        const deviceList = devices
          .filter(m => m.kind === deviceType + 'input')
          .reduce((obj, item) => Object.assign(obj, {[item.deviceId]: item.label}), {});
        console.log(devices, deviceList);
        setSettingDeviceOptions(deviceType, deviceList);
      });
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

    clearInterval(this.updateSmoothedSoundInterval);
    clearInterval(this.sortScreensInterval);

    if (this.room) {
      try {
        await this.room.leave();
      } catch (e) {
        console.error(`Failed to unload jitsi room`, e, e.stack);
      }
    }

    if (this.connection) {
      this.connection.disconnect();
    }

    JitsiMeetJS.mediaDevices.removeEventListener(
        JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
        this.updateDeviceListBinded);
  }

  /**
   * Mute the local track
   * @param {string} type Which type to mute (audio|video)
   */
  async mute(type) {
    for (const track of this.localTracks) {
      if (track.getType() === type) {
        track.mute();

        $(`#jitsi-local > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
        $(`#jitsi-local-track-${track.getType()}`).css('display', 'none');
      }
    }
  }

  /**
   * Unmute the local track
   * @param {string} type Which type to unmute (audio|video)
   */
  async unmute(type) {
    for (const track of this.localTracks) {
      if (track.getType() === type) {
        track.unmute();

        $(`#jitsi-local > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
        if (track.getType() === 'video') {
          $(`#jitsi-local-track-${track.getType()}`).css('display', 'block');
        }
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
   */
  async setLocalAudioVolumeMeter() {
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
        // If the audio track is muted, return 0.
        if (this.localTracks.filter(track => track.getType() === 'audio' && !track.isMuted()).length === 0) {
          this.room?.setLocalParticipantProperty('volume', '0');
          $(`#jitsi-local`).removeClass('speaking');
          return;
        }

        analyser.getByteFrequencyData(volumes);
        const averageVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

        // parsed volume = round((normalize(original volume - noise threshold) * 100 [transform [0, 1] to [0, 100]]) / 10) [discretization]
        let averageVolumeParsed = (Math.round(((averageVolume - 30) / (analyser.maxDecibels - analyser.minDecibels - 30) * 100) / 10));
        averageVolumeParsed = Math.min(Math.max(averageVolumeParsed, 0), 10); // clip to [0, 10]

        this.room?.setLocalParticipantProperty('volume', averageVolumeParsed.toString());

        if (parseInt(averageVolumeParsed) >= VOICE_INDICATOR_THRESHOLD) {
          $(`#jitsi-local`).addClass('speaking');
        } else {
          $(`#jitsi-local`).removeClass('speaking');
        }
      };
    } catch (e) {
      console.error('Failed to setup audio volume meter: ', e);
    }


    this.volumeMeterIntervalId = setInterval(() => {
      try {
        volumeCallback();
      } catch (e) {
        console.error('Volume metering failed in volumeCallback(): ', e);
        clearInterval(this.volumeMeterIntervalId);
      }
    }, 100);
  }

  /**
   * Set the volume meter of the remote participant.
   */
  setRemoteVolumeMeter(user, propertyKey, oldPropertyValue, propertyValue) {
    if (propertyKey !== 'volume') {
      return;
    }

    const newVolume = parseInt(propertyValue);

    this.participantSounds[user.getId()] = newVolume;
    if (newVolume >= 1) {
      $(`#jitsi-${user.getId()}-container`).addClass('speaking');
    } else {
      $(`#jitsi-${user.getId()}-container`).removeClass('speaking');
    }
  }

  /**
   * Update the smoothed soundness.
   */
  updateSmoothedSound() {
    for (const id in this.participantSounds) {
      this.participantSmoothedSounds[id] = ALPHA * this.participantSounds[id] + (1 - ALPHA) * this.participantSmoothedSounds[id];
    }
  }

  /**
   * Sort the Jitsi screen based on the exponentially smoothed soundness.
   */
  sortScreens() {
    $('#jitsi-remote-container > .jitsi-user-container').sort((a, b) => {
      const aid = $(a).attr('data-id');
      const bid = $(b).attr('data-id');
      return this.participantSmoothedSounds[bid] - this.participantSmoothedSounds[aid];
    }).appendTo('#jitsi-remote-container');
  }
}
export default JitsiHandler;
