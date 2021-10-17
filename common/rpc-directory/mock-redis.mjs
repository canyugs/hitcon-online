// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause
import assert from 'assert';

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

class MockRedisClient {
    constructor(mockRedis) {
        this._mockRedis = mockRedis;
        this._data = mockRedis._data;
    }

    get(key, cb) {
        if (this._data.has(key[0])) {
            if (typeof cb === 'function') cb(null, this._data.get(key[0]));
        } else {
            if (typeof cb === 'function') cb(null, null); // If the key does not exist the special value nil is returned.
        }
    }

    set(kv, cb) {
        if (kv.length < 2) throw 'Missing key and value';
        if (kv.length == 3 && kv[2] == "NX" && this._data.has(kv[0])) {
            if (typeof cb === 'function') cb(null, null);
            return;
        }

        this._data.set(kv[0], kv[1]);
        if (typeof cb === 'function') cb(null, 'OK');
    }

    incr(k, cb) {
      this.incr_decr_internal(k, cb, 1);
    }

    decr(k, cb) {
      this.incr_decr_internal(k, cb, -1);
    }

    incr_decr_internal(k, cb, delta) {
      if (k.length != 1) throw 'Invalid key for incr';
      if (!this._data.has(k[0])) {
        this._data.set(k[0], '0');
      }
      let n = 0;
      let v = this._data.get(k[0]);
      n = parseInt(v, 10);
      if (!Number.isInteger(n) || Number.isNaN(n)) {
        console.error('incr on non integer', v);
        throw 'ERR value is not an integer or out of range';
      }
      n += delta;
      this._data.set(k[0], n.toString());
      if (typeof cb === 'function') cb(null, n);
    }

    del(keys, cb) {
        for (let key of keys) {
            this._data.delete(key);
        }
        if (typeof cb === 'function') cb(null, 1);
    }

    subscribe(channel, cb) {
        this._mockRedis.subscribed[channel] = 1;
        if (typeof cb === 'function') cb(null, true);
    }

    publish(channel, message, cb) {
        if (channel in this._mockRedis.subscribed) {
            for (const f of this._mockRedis.callbacks) {
                f(channel, message);
            }
        }
        if (typeof cb === 'function') cb(null, true);
    }

    on(event, callback) {
        if (event == 'message') {
            this._mockRedis.callbacks.push(callback);
        }
    }

    hget(kf, cb) {
        if (kf.length < 2) throw 'Missing key and value';
        let key = kf[0], field = kf[1];
        if (this._data.has(key) && (this._data.get(key) instanceof Map) && this._data.get(key).has(field)) {
            if (typeof cb === 'function') cb(null, this._data.get(key).get(field));
        } else {
            if (typeof cb === 'function') cb(null, null);
        }
    }

    hset(kfv, cb) {
        if (kfv.length < 3) throw 'Missing key, field, and value';
        let key = kfv[0], field = kfv[1], value = kfv[2];
        if (!this._data.has(key) || !(this._data.get(key) instanceof Map)) {
            this._data.set(key, new Map());
        }
        this._data.get(key).set(field, value);

        if (typeof cb === 'function') cb(null, 1);
    }

    hgetall(key, cb) {
        let obj = {};
        if (this._data.has(key) && (this._data.get(key) instanceof Map)) {
            this._data.get(key).forEach((v, k) => { obj[k] = v; });
        }
        if (typeof cb === 'function') cb(null, obj);
    }

    flushall(cb) {
        this._data.clear();
        if (typeof cb === 'function') cb(null, null);
    }

    scan(cb) {
        cb(null, [0, Array.from(this._data.keys())]);
    }
}

export default MockRedis;
