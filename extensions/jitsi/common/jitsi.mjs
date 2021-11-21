// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import {createRnnoiseProcessor} from './rnnoise/index.js';

const VOICE_INDICATOR_THRESHOLD = 0.4;

// constant for exponential smoothing, deltaT = 0.1s, fc = 1/30 Hz
const ALPHA = 0.0205;

// constant for the max amount of remote users able to display in the overlay
const REMOTE_USER_MAXAMOUNT = 3;

/**
 * This class is the browser/client side of an extension.
 * One instance is created for each connected player.
 */
class JitsiHandler {
  constructor(getDevices, setSettingDeviceOptions, broadcastParticipantId) {
    this.getDevices = getDevices;
    this.setSettingDeviceOptions = setSettingDeviceOptions;
    this.broadcastParticipantId = broadcastParticipantId;

    $(window).bind('beforeunload', this.unload.bind(this));
    $(window).bind('unload', this.unload.bind(this));

    /* Bind functions */
    this.disconnectBinded = this.disconnect.bind(this);
    this.onConnectionFailedBinded = this.onConnectionFailed.bind(this);
    this.onConnectionSuccessBinded = this.onConnectionSuccess.bind(this);

    this.updateDeviceListBinded = () => {
      JitsiHandler.updateDeviceList(this.setSettingDeviceOptions);
    };

    this.isInMeeting = false;
    this.connectionLock = false;
  }

  /**
   * Create Jitsi connection
   */
  connect(meetingName, password, userName, connectionInfo) {
    this.meetingName = meetingName;
    this.password = password;
    this.userName = userName;

    this.connection = null;
    this.isVideo = true;
    this.localTracks = {};
    this.remoteTracks = {};
    this.volumeMeters = {};
    this.participantsInfo = {};
    this.participantSounds = {};
    this.participantSoundsLastUpate = {};
    this.participantSmoothedSounds = {};
    this.isJoined = false;
    this.room = null;
    this.isWebcam = true; // Is webcam or screen sharing.
    this.playerIdToParticipantIdMapping = {};

    this.isInMeeting = true;

    // Is track muted
    this.isMuted = {video: true, audio: true};

    JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
    JitsiMeetJS.init({});

    if (this.connectionLock) {
      return;
    }
    this.connectionLock = true;

    this.connection = new JitsiMeetJS.JitsiConnection(null, null, {
      ...connectionInfo,
      serviceUrl: connectionInfo.serviceUrl + `?room=${meetingName}`
    });

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

    /* Sort the jitsi screens periodically */
    this.updateSmoothedSoundInterval = setInterval(this.updateSmoothedSound.bind(this), 100);
    this.sortScreensInterval = setInterval(this.sortScreens.bind(this), 2500);

    this.connection.connect();

    $('#jitsi-local').empty();

    this.connectionLock = false;
  }

  /**
   * Create local track. This method would drop all current local tracks.
   */
  async createLocalTrack(type) {
    console.log('createLocalTrack', type);
    if (!this.isWebcam && type === 'desktop' && !JitsiMeetJS.isDesktopSharingEnabled()) {
      throw new Error('Screen sharing is not enabled.');
    }

    // Create new local tracks
    const tracks = await JitsiMeetJS.createLocalTracks({
      devices: [type],
      cameraDeviceId: this.getDevices('video'),
      micDeviceId: this.getDevices('audio')
    });
    await this.onLocalTracks(tracks);
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
      $('#jitsi-local-user-name').text(this.userName);
    }

    for (const track of tracks) {
      const trackId = 'jitsi-local-track-' + track.getType();
      if (track.getType() === 'video') {
        $('#jitsi-local > .jitsi-user-video').empty();
        $('#jitsi-local > .jitsi-user-video').append(`<video autoplay='1' id='${trackId}' class='jitsi-local-video' />`);
        track.attach($(`#${trackId}`)[0]);
      } else if (track.getType() === 'audio') {
        $('#jitsi-local > .jitsi-user-audio').empty();
        $('#jitsi-local > .jitsi-user-audio').append(`<audio autoplay='1' muted='true' id='${trackId}' class='jitsi-audio' />`);
        track.attach($(`#${trackId}`)[0]);
      } else {
        console.error('Unknown track type:', track.getType());
        continue;
      }

      // Check if the track should be muted, unless it is screen sharing.
      if ((this.isWebcam || track.getType() !== 'video') && this.isMuted[track.getType()]) {
        track.mute();
      } else {
        track.unmute();
      }

      // Add mute overlay
      if ((this.isWebcam || track.getType() !== 'video') && this.isMuted[track.getType()]) {
        $(`#jitsi-local > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
        $(`#${trackId}`).css('display', 'none');
      } else {
        $(`#jitsi-local > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
      }

      if (track.getType() === 'audio') {
        JitsiMeetJS.createTrackVADEmitter(track.getDeviceId(), 4096, await createRnnoiseProcessor());
      }

      if (track.getType() in this.localTracks) {
        await this.room.replaceTrack(this.localTracks[track.getType()], track);
      } else {
        await this.room.addTrack(track);
      }

      this.localTracks[track.getType()] = track;
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
      if ($('#jitsi-remote-container').children().length < REMOTE_USER_MAXAMOUNT) {
        $('#jitsi-remote-container').append(`
          <div class='jitsi-user-container active' id='jitsi-${participantId}-container' data-id='${participantId}'>
            <div class='jitsi-user-loading'></div>
            <div class='jitsi-user-video'></div>
            <div class='jitsi-user-audio'></div>
            <div class='jitsi-user-name' id='jitsi-${participantId}-user-name'>${this.participantsInfo[participantId]._displayName}</div>
          </div>
        `);
      } else {
        $('#jitsi-modal-container').append(`
          <div class='jitsi-user-container active' id='jitsi-${participantId}-container' data-id='${participantId}'>
            <div class='jitsi-user-loading'></div>
            <div class='jitsi-user-video'></div>
            <div class='jitsi-user-audio'></div>
            <div class='jitsi-user-name' id='jitsi-${participantId}-user-name'>${this.participantsInfo[participantId]._displayName}</div>
          </div>
        `);
      }
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

    // Check if this is a dangling user.
    if (!Object.values(this.playerIdToParticipantIdMapping).includes(participantId)) {
      console.warn('Found dangling paritcipant', participantId);
      $(`#jitsi-${participantId}-container`).hide();
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

    try {
      this.createLocalTrack('audio');
    } catch (e) {
      console.error('Failed to create audio track', e);
    }

    try {
      this.createLocalTrack(this.isWebcam ? 'video' : 'desktop');
    } catch (e) {
      console.error('Failed to create video track', e);
    }

    $('#jitsi-local').addClass('active');
    this.broadcastParticipantId(this.room.myUserId()); // broadcast the paritcipant id.
  }

  /**
   * This is executed when an user left.
   * @param {string} id The participant id of the user just left.
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
    delete this.participantSoundsLastUpate[id];
    delete this.participantSmoothedSounds[id];
  }

  /**
   * This is executed when an user joined.
   * @param {string} id The participant id.
   * @param {JitsiParticipant} user
   */
  onUserJoin(id, user) {
    console.log('user joined: ', id, user._displayName);
    this.participantsInfo[id] = user;
    this.participantSounds[id] = 0;
    this.participantSoundsLastUpate[id] = 0;
    this.participantSmoothedSounds[id] = 0;
    this.remoteTracks[id] = [];
  }

  /**
   * Update the user's display name.
   * @param {string} id The participant id.
   * @param {string} displayName The new display name.
   */
  onDisplayNameChanged(id, displayName) {
    $(`#jitsi-${id}-user-name`).text(displayName);
  }

  /**
   * This is called when connection is established successfully
   */
  onConnectionSuccess() {
    if (this.connectionLock) {
      return;
    }
    this.connectionLock = true;

    this.room = this.connection.initJitsiConference(
      this.meetingName.toLowerCase(),
      {
        e2eping: {
          pingInterval: -1
        },
        enableLayerSuspension: true
      }
    );
    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, this.onRemoteTrack.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, this.onRemoteTrackRemove.bind(this));
    this.room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, this.onConferenceJoined.bind(this));
    this.room.on(JitsiMeetJS.events.conference.USER_JOINED, this.onUserJoin.bind(this));
    this.room.on(JitsiMeetJS.events.conference.USER_LEFT, this.onUserLeft.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, this.onTrackMute.bind(this));
    // this.room.on(JitsiMeetJS.events.conference.PARTICIPANT_PROPERTY_CHANGED, this.setRemoteVolumeMeter.bind(this));
    this.room.on(JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED, (participantId, audioLevel) => {
      console.log(participantId, audioLevel);
      this.participantSounds[participantId] = audioLevel;
    });

    this.room.setDisplayName(this.userName);
    this.room.setSenderVideoConstraint(720);
    this.room.join(this.password);

    this.connectionLock = false;
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
    this.connection = undefined;
    this.unload();
  }

  /**
   * Leave the room and clean up the connection.
   */
  async unload() {
    // Prevent unloading multiple times.
    if (this.connectionLock) {
      return;
    }
    this.connectionLock = true;

    if (this.localTracks) {
      for (const [type, track] of Object.entries(this.localTracks)) {
        await track.dispose();
      }
    }

    await this.broadcastParticipantId(null); // broadcast that the player has quit.

    // We can safely remove all DOMs at this point.
    $('#jitsi-remote-container').empty();
    $('#jitsi-local').empty();

    clearInterval(this.updateSmoothedSoundInterval);
    clearInterval(this.sortScreensInterval);

    if (this.room) {
      try {
        await this.room.leave();
        this.room = undefined;
      } catch (e) {
        console.error(`Failed to unload jitsi room`, e, e.stack);
      }
    }

    if (this.connection) {
      this.connection.disconnect();
    }

    this.isInMeeting = false;
    this.connectionLock = false;
  }

  /**
   * Mute the local track
   * @param {string} type Which type to mute (audio|video)
   */
  async mute(type) {
    if (!(type in this.localTracks)) {
      return;
    }

    const track = this.localTracks[type];
    this.isMuted[type] = true;

    track.mute();
    $(`#jitsi-local > .jitsi-user-${track.getType()}`).addClass(`jitsi-user-${track.getType()}--close`);
    $(`#jitsi-local-track-${track.getType()}`).css('display', 'none');

  }

  /**
   * Unmute the local track
   * @param {string} type Which type to unmute (audio|video)
   */
  async unmute(type) {
    if (!(type in this.localTracks)) {
      return;
    }

    const track = this.localTracks[type];
    this.isMuted[type] = false;

    track.unmute();
    $(`#jitsi-local > .jitsi-user-${track.getType()}`).removeClass(`jitsi-user-${track.getType()}--close`);
    if (track.getType() === 'video') {
      $(`#jitsi-local-track-${track.getType()}`).css('display', 'block');
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
   * Update the smoothed soundness.
   */
  updateSmoothedSound() {
    for (const id in this.participantSounds) {
      this.participantSmoothedSounds[id] = ALPHA * this.participantSounds[id] + (1 - ALPHA) * this.participantSmoothedSounds[id];

      if (this.participantSmoothedSounds[id] >= VOICE_INDICATOR_THRESHOLD) {
        $(`#jitsi-${id}-container`).addClass('speaking');
      } else {
        $(`#jitsi-${id}-container`).removeClass('speaking');
      }
    }
  }

  /**
   * Sort the Jitsi screen based on the exponentially smoothed soundness.
   */
  sortScreens() {
    const remoteUserDOM = $('#jitsi-remote-container > .jitsi-user-container, #jitsi-modal-container > .jitsi-user-container').sort((a, b) => {
      const aid = $(a).attr('data-id');
      const bid = $(b).attr('data-id');
      return this.participantSmoothedSounds[bid] - this.participantSmoothedSounds[aid];
    })
    remoteUserDOM.slice(0, REMOTE_USER_MAXAMOUNT).appendTo('#jitsi-remote-container');
    remoteUserDOM.slice(REMOTE_USER_MAXAMOUNT).appendTo('#jitsi-modal-container');
  }

  /**
   * Update the playerIdToParticipantIdMapping, and check if there is any dangling user
   * @param playerIdToParticipantIdMapping
   */
  updateIdMappingAndRemoveDanglingUser(playerIdToParticipantIdMapping) {
    this.playerIdToParticipantIdMapping = playerIdToParticipantIdMapping;
    $('#jitsi-remote-container > .jitsi-user-container, #jitsi-modal-container > .jitsi-user-container').each(function() {
      if (Object.values(playerIdToParticipantIdMapping).includes($(this).attr('data-id'))) {
        $(this).show();
      } else {
        $(this).hide();
        console.warn(`Found dangling paritcipant ${$(this).attr('data-id')}`);
      }
    });


  }
}
export default JitsiHandler;
