import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('config');
const bodyParser = require('body-parser');

class AuthServer {
    /*
    * Create a auth server, but doesn't start it.
    * @constructor
    * @param {app} - An express app or router compatible with express.js.
    */
    constructor(app) {
        this.app = app;
        this.secret = config.get('secret');
        this.app.set('secret', this.secret);
        this.urlencodedParser = bodyParser.urlencoded({extended: false});
    }

    /**
     * Verify the token and return the token parameter if valid
     * @param {object} token - a string of token which can be verified by jwt
     * @return {object} token - null if the verification failed. The actual
     * token if verification is successful.
     */
    verifyToken(token) {
        let ret = null;
        if (!token) {
            return null;
        }

        let secret = this.secret;
        if (!Array.isArray(secret)) {
          secret = [secret, ];
        }
        let errs = [];
        for (const s of secret) {
          try {
              ret = jwt.verify(token, s);
          } catch (err) {
              errs.push(err);
              ret = null;
          }
          if (ret !== null) break;
        }
        if (ret === null) {
          console.error('Failed to verify jwt in verifyToken(): ', errs);
          return null;
        }

        if (typeof ret !== 'object') {
            console.error('JWT Payload is not object.');
            return null;
        }

        // Check for valid subject in the token.
        if (!('sub' in ret) || typeof ret.sub !== 'string') {
            console.error('Invalid subject in token found for verifyToken.');
            // Reject the client.
            return null;
        }
        return ret;
    }

    /**
     * Set token into the cookie.
     */
    handleAuth(req, res, token) {
        if (token) {
            const secret = this.secret;
            const result = this.verifyToken(token);
            if (result) {
                res.cookie('token', token);
                res.redirect('/');
            } else {
                return res.json({
                    success: false,
                    message: 'Failed to authenticate token.'
                });
            }
        } else {
            return res.status(403).send({
                success: false,
                message: 'No token provided.'
            });
        }
    }

    /*
    * Start the auth server to route
    * @run
    */
    run() {
        this.app.post('/auth', this.urlencodedParser, (req, res) => {
            var token = req.body.token || req.body.query || req.headers['x-access-token'];
            this.handleAuth(req, res, token);
        });

        this.app.get('/auth', (req, res) => {
            var token = req.query.token || req.headers['x-access-token'];
            this.handleAuth(req, res, token);
        });

        this.app.get('/get_test_token', function(req, res) {
            if (config.get('debug') !== true) {
              console.warn('Trying to access /get_test_token on non-debug enviroment');
              res.status(403).send('/get_test_token not available on non-debug enviroment');
              return;
            }
            function genRandomStr(l) {
              const sourceSet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
              let result = '';
              for (let i = 0; i < l; i++) {
                result += sourceSet[Math.floor(Math.random()*sourceSet.length)];
              }
              return result;
            }
            const scopeStr = req.query.scope?req.query.scope:'';
            const payload = {};
            payload.iss = 'https://hitcon.org';
            payload.sub = genRandomStr(5);
            payload.iat = Math.floor(Date.now() / 1000);
            payload.scp = (scopeStr==='')?[]:scopeStr.split('|');
            let secret = this.secret;
            if (Array.isArray(secret)) {
              secret = secret[0];
            }
            const token = jwt.sign(payload, secret, {expiresIn: 60 * 60 * 24 * 365});
            res.cookie('token', token);
            res.json({
                success: true,
                token: token
            });
        });
    }
}

export default AuthServer;
