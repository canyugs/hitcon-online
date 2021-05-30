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
            if(typeof cb === 'function') cb(null, this._data.get(key));
        } else {
            if(typeof cb === 'function') cb(null, null); // If the key does not exist the special value nil is returned.
        }
    }

    set(kv, cb) {
        if(kv.length < 2) throw 'Missing key and value';
        if(kv.length == 3 && kv[2] == "NX" && this._data.has(kv[0])){
            if(typeof cb === 'function') cb(null, null);
            return;
        }

        this._data.set(kv[0], kv[1]);
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

    hget(kf, cb) {
        if(kf.length < 2) throw 'Missing key and value';
        let key = kf[0], field = kf[1];
        if (this._data.has(key) && (this._data.get(key) instanceof Map) && this._data.get(key).has(field)){
            if(typeof cb === 'function') cb(null, this._data.get(key).get(field))
        } else {
            if(typeof cb === 'function') cb(null, null);
        }
    }

    hset(kfv, cb) {
        if(kfv.length < 2) throw 'Missing key, field, and value';
        let key = kfv[0], field = kfv[1], value = kfv[2];
        if(!this._data.has(key) || !(this._data.get(key) instanceof Map)){
            this._data.set(key, new Map());
        }
        if(typeof cb === 'function') cb(null, this._data.get(key).set(field, value));
    }
}

export default MockRedis;