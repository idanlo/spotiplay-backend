/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
dotenv.config();
var mode = process.env.MODE; // "dev" or "prod"

var modes = {
  prod: {
    baseURL: process.env.PROD_BASE_URL,
    redirect_uri: process.env.PROD_REDIRECT_URI
  },
  dev: {
    baseURL: process.env.DEV_BASE_URL,
    redirect_uri: process.env.DEV_REDIRECT_URI
  }
};

var client_id = process.env.CLIENT_ID; // Your client id
var client_secret = process.env.CLIENT_SECRET; // Your secret

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(cors()).use(cookieParser());

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope =
    'playlist-read-private playlist-modify-public user-read-currently-playing playlist-read-collaborative user-read-recently-played user-modify-playback-state user-follow-read playlist-modify-private app-remote-control user-top-read streaming user-read-private user-read-playback-state user-follow-modify user-read-email user-library-modify user-library-read';
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: modes[mode].redirect_uri,
        state: state
      })
  );
});

app.post('/refresh', function(req, res) {
  req.on('data', function(data) {
    const tokenObj = JSON.parse(data).data;
    const token = JSON.parse(tokenObj).refresh_token;
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        refresh_token: token,
        grant_type: 'refresh_token'
      },
      headers: {
        Authorization:
          'Basic ' +
          createBuffer(client_id + ':' + client_secret).toString('base64')
      },
      json: true
    };
    request.post(authOptions, function(err, response, body) {
      if (!err && response.statusCode === 200) {
        res.json(response.body);
      } else {
        res.status(response.statusCode).json(err);
      }
    });
  });
});

app.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch'
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: modes[mode].redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        Authorization:
          'Basic ' +
          createBuffer(client_id + ':' + client_secret).toString('base64')
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          modes[mode].baseURL +
            '/#' +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token
            })
        );
      } else {
        res.redirect(
          modes[mode].baseURL +
            '/#' +
            querystring.stringify({
              error: 'invalid_token'
            })
        );
      }
    });
  }
});

// A polyfill for new Buffer() which is deprecated in new Node versions in favor or Buffer.from()
function createBuffer(bufferContent) {
  let buf;
  if (Buffer.from && Buffer.from !== Uint8Array.from) {
    buf = Buffer.from(bufferContent);
  } else {
    if (typeof bufferContent === 'number') {
      throw new Error('The "size" argument must be not of type number.');
    }
    buf = new Buffer(bufferContent);
  }
  return buf;
}

console.log('Listening on', process.env.PORT || 8888);
app.listen(process.env.PORT || 8888);
