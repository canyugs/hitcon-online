var express = require('express')
var app = express()
var jwt = require('jsonwebtoken')
var secret = 'secret'
var bodyParser = require('body-parser')
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var cookies = require("cookie-parser");

app.use(cookies())

app.set('secret', secret)

app.use('/static', express.static(__dirname + '/../../sites/'));
app.get('/client', function(req, res){
    console.log(__dirname)
    res.redirect('/')  
})

app.get('/', function (req, res) {
    var token = jwt.sign({'test': 'test_token'}, app.get('secret'))

    res.json({
        success: true,
        token: token
    })
})

app.post('/auth', urlencodedParser, function(req, res){
    console.log(req.body.token)
    var token = req.body.token || req.body.query || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, app.get('secret'), function(err, decoded) {
            if (err) {
                return res.json({
                    success: false,
                    message: 'Failed to authenticate token.'
                })
            } else {
                res.cookie('token', token, {httpOnly: true})
                res.json({
                    success: true,
                    token: decoded
                })
                console.log(decoded)
            }
        })
    } else {
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        })
    }   
})

app.get('/authcookie', function(req, res){
    console.log(req.cookies.token)
    res.send('haha')
})

app.listen(5001, function () {
  console.log('The server is running at port 5001')
})
