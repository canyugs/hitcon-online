// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

class MockRedis {
    /**
     * Create the Mock Redis.
     * @constructor
     */
    constructor() {
        this._data = new Map();
        this.clients = [];
        this.callbacks = [];
        this.subscribed = {};
    }

    createClient() {
        let newClient = new MockRedisClient(this);
        this.clients.push(newClient);
        return newClient;
    }
}

class MockRedisClient{
    constructor(mockRedis) {
        this._mockRedis = mockRedis;
        this._data = mockRedis._data;
    }

    get(key, cb) {
        if (this._data.has(key)){
            cb(null, this._data.get(key));
        } else {
            cb(null, null); // If the key does not exist the special value nil is returned.
        }
    }

    set(key, value, cb) {
        this._data.set(key, value);
        if(typeof cb === 'function') cb(null, true);
    }

    subscribe(channel, cb) {
        this._mockRedis.subscribed[channel] = 1;
        if(typeof cb === 'function') cb(null, true);
    }

    publish(channel, message, cb) {
        if (channel in this._mockRedis.subscribed) {
            for (const f of this._mockRedis.callbacks) {
                f(channel, message);
            }
        }
        if(typeof cb === 'function') cb(null, true);
    }

    on(event, callback) {
        if (event == 'message') {
            this._mockRedis.callbacks.push(callback);
        }
    }

    hget(key, cb) {
        if (this._data.has(key)){
            cb(null, this._data.get(key));
        } else {
            cb(null, null);
        }
    }

    hset(key, value, cb) {
        if(typeof cb === 'function') cb(null, this._data.set(key, value));
    }
}

export default MockRedis;