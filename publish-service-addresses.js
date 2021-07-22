// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

// Only for dev

const redis = require('redis');
const promisify = require('util').promisify;

redisClient = redis.createClient();
redisClient.on('error', (err) => {
    console.log("Real redis not found, skipping Redis initialization.");
    process.exit();
});

(async () => {
    try {
        const hmset = promisify(redisClient.hmset).bind(redisClient);
        const flushall = promisify(redisClient.flushall).bind(redisClient);
        await flushall();
        await hmset("ServiceIndex", "ext_chat", "127.0.0.1:5005");
        await hmset("ServiceIndex", "ext_helloworld", "127.0.0.1:5006");
        await hmset("ServiceIndex", "gatewayServer", "127.0.0.1:5001");
        redisClient.quit();
    } catch {};
})();