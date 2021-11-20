// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import crypto from 'crypto';

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

const config = require('config');

/**
 * Get config from config with default.
 */
function getConfigWithDefault(entry, def) {
  let res = def;
  try {
    res = config.get(entry);
  } catch (e) {
    console.warn('Failed to get config with default: ', entry, e);
  }
  return res;
}

/**
 * This represents the standalone extension service for this extension.
 */
class Standalone {
  /**
   * Create the standalone extension service object but does not start it.
   * @constructor
   * @param {ExtensionHelper} helper - An extension helper object for servicing
   * various functionalities of the extension.
   */
  constructor(helper) {
    this.helper = helper;
    this.meetingName2playerId2ParticipantIdMapping = {};
    this.hmacSecret = getConfigWithDefault('jitsi.hmacSecret', undefined);
    if (typeof this.hmacSecret !== 'string' || this.hmacSecret.length === 0) {
      this.hmacSecret = undefined;
    }
    this.prefix = getConfigWithDefault('jitsi.prefix', undefined);
    if (typeof this.prefix !== 'string') {
      this.prefix = '';
    }
    this.hosts = getConfigWithDefault('jitsi.hosts',  {
      "domain": "meet.jit.si",
      "muc": "conference.meet.jit.si",
      "focus": "focus.meet.jit.si"
    });
  }

  /**
   * Initializes the extension.
   */
  async initialize() {
    // Notify to remove the recently quit user.
    this.helper.registerOnPlayerUpdate((msg) => {
      if (!msg?.removed) {
        return;
      }

      for (const meetingName in this.meetingName2playerId2ParticipantIdMapping) {
        if (Object.keys(this.meetingName2playerId2ParticipantIdMapping[meetingName]).includes(msg.playerID)) {
          delete this.meetingName2playerId2ParticipantIdMapping[meetingName][msg.playerID];
          for (const playerID in this.meetingName2playerId2ParticipantIdMapping[meetingName]) {
            this.helper.callS2cAPI(playerID, 'jitsi', 'updateIdMappingAndRemoveDanglingUser', 5000, this.meetingName2playerId2ParticipantIdMapping[meetingName]);
          }
        }
      }
    });
  }

  /**
   * Get the password of the specific
   * @param {Player} player - player information
   * @param {string} meetingName - the name of the requested meeting
   * @returns string
   */
  async c2s_getPassword(player, args) {
    // TODO: Authentication for jitsi is not implemented yet.
    if (typeof args !== 'object' || args === null) {
      console.warn('Invalid parameter in jitsi.c2s_getPassword: ', player, args);
      return {'error': 'Invalid args'};
    }

    const loc = await this.helper.getPlayerLocation(player.playerID);
    if (typeof loc !== 'object' || loc === null) {
      console.warn('Failed to get location for player in jitsi.c2s_getPassword: ', player, loc);
      return {'error': 'No location'};
    }

    const cell = this.helper.gameMap.getCell(loc, 'jitsi');
    if (cell !== args.meetingName) {
      console.warn('Player attempts jitsi.c2s_getPassword on incorrect meetingName: ', player, cell, args.meetingName);
      return {'error': 'Incorrect meetingName'};
    }

    let meetingName = args.meetingName;
    if (typeof this.hmacSecret === 'string') {
      // HMAC for meetingName is enabled.
      const c = crypto.createHmac('sha256', this.hmacSecret);
      c.update(meetingName);
      meetingName = c.digest().toString('hex');
    }
    meetingName = this.prefix + meetingName;
    return {'pass': 'Unimplemented', 'meetingName': meetingName, 'hosts': this.hosts};
  }

  /**
   * Update the mapping for the player ID and the Jitsi participant ID.
   * @param {Player} player - player information
   * @param {object} args - participant id and  meeting name
   */
   async c2s_updateIdMapping(player, args) {
    const {participantId, meetingName} = args;
    if (!(meetingName in this.meetingName2playerId2ParticipantIdMapping)) {
      this.meetingName2playerId2ParticipantIdMapping[meetingName] = {};
    }

    if (participantId) {
      this.meetingName2playerId2ParticipantIdMapping[meetingName][player.playerID] = participantId;
    } else if (player.playerID in this.meetingName2playerId2ParticipantIdMapping[meetingName]) {
      delete this.meetingName2playerId2ParticipantIdMapping[meetingName][player.playerID];
    }

    for (const playerID in this.meetingName2playerId2ParticipantIdMapping[meetingName]) {
      this.helper.callS2cAPI(playerID, 'jitsi', 'updateIdMappingAndRemoveDanglingUser', 5000, this.meetingName2playerId2ParticipantIdMapping[meetingName]);
    }

    return true;
   }
}

export default Standalone;
