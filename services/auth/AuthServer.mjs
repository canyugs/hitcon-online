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

    /*
    * Verify the token and return the token parameter if valid
    * @verifyToken
    * @param {token} - a string of token which can be verified by jwt
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
        return ret
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
    }
}

export default AuthServer
