import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const express = require('express')
const jwt = require('jsonwebtoken')
const config = require('config')
const bodyParser = require('body-parser')

class AuthServer{
    /*
    * Create a auth server, but doesn't start it.
    * @constructor
    * @param {app} - An express app or router compatible with express.js.
    */
    constructor(app){
        this.app = app
        this.app.set('secret', config.get('secret'))
        this.urlencodedParser = bodyParser.urlencoded({ extended: false })
    }

    /**
     * Verify the token and return the token parameter if valid
     * @param {object} token - a string of token which can be verified by jwt
     * @return {object} token - null if the verification failed. The actual
     * token if verification is successful.
     */
    verifyToken(token){
        var ret = null;
        if (token){
            jwt.verify(token, this.app.get('secret'), function(err, decoded) {
                if(err) {
                    return
                } else {
                    ret = decoded
                }
            })
        } else {
            return null
        }
        // Check for valid subject in the token.
        if (!('sub' in ret) || typeof ret.sub != 'string') {
            console.error('Invalid subject in token found for verifyToken.');
            // Reject the client.
            return null;
        }
        return ret;
    }
    
    /*
    * Start the auth server to route
    * @run
    */
    run(){
        const secret = this.app.get('secret')
        this.app.post('/auth', this.urlencodedParser, function(req, res){
            var token = req.body.token || req.body.query || req.headers['x-access-token'];
            if (token) {
                jwt.verify(token, secret, function(err, decoded) {
                    if (err) {
                        return res.json({
                            success: false,
                            message: 'Failed to authenticate token.'
                        })
                    } else {
                        res.cookie('token', token, {httpOnly: true})
                        res.redirect('/')
                    }
                })
            } else {
                return res.status(403).send({
                    success: false,
                    message: 'No token provided.'
                })
            }   
        })

        this.app.get('/get_test_token', function(req, res) {
            function genRandomStr(l) {
              const sourceSet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
              let result = '';
              for (let i = 0; i < l; i++) {
                result += sourceSet[Math.floor(Math.random()*sourceSet.length)];
              }
              return result;
            }
            const payload = {};
            payload.iss = 'https://hitcon.org';
            payload.sub = genRandomStr(5);
            payload.iat = Math.floor(Date.now() / 1000);
            payload.exp = 1630425600; // 2021/09/01
            const token = jwt.sign(payload, secret);
            res.cookie('token', token);
            res.json({
                success: true,
                token: token
            });
        })
    }
}

export default AuthServer
