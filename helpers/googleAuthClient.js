// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Modified by cezips@gmail.com on 2016-07-15

'use strict';

const google = require('googleapis'),
    OAuth2Client = google.auth.OAuth2,
    http = require('http'),
    spawn = require('child_process').spawn,
    url = require('url'),
    querystring = require('querystring'),
    redis = require('redis').createClient(),
    request = require('request'),
    secrets = require('./../config/secrets.json');

const redisAccessTokenKey = "access_token_google";

class AuthClient {

    constructor(options = { scopes: [] }) {
        this.isAuthenticated = false;
        this._options = options;

        // create an oAuth client to authorize the API call
        this.oAuth2Client = new OAuth2Client(
            secrets.web.client_id,
            secrets.web.client_secret,
            secrets.web.redirect_uris[0]
        );
    }

    // Open an http server to accept the oauth callback. In this
    // simple example, the only request to our webserver is to
    // /callback?code=<code>
    authenticate(scopes = secrets.web.scopes, callback) {
        let tokens = {
            access_token: "",
            refresh_token: secrets.web.refresh_token
        };

        // redis 에서 "access_token_google" 키 값으로 액세스 토큰 로딩하여 tokens 에 할당
        redis.get(redisAccessTokenKey, (err, reply) => {
            if (err) return console.error(err.message);

            if (reply) {
                tokens.access_token = reply.toString();
            } else {
                // 토큰값이 없으면 expired 된 토큰 값 할당
                tokens.access_token = '';
            }

            /**
             * 토큰 검증 End-point 에 request() 를 때려봐서 토큰 검증
             Response :
             가용 토큰 =
             {
                 "issued_to": "00000000000-ja2hto70sflini5thrhqkl1a8de6qou4.apps.googleusercontent.com",
                 "audience": "00000000000-ja2hto70sflini5thrhqkl1a8de6qou4.apps.googleusercontent.com",
                 "scope": string,
                 "expires_in": 3590,
                 "access_type": "offline"
             }

             만료된 토큰 =
             {
                 "error": "invalid_token",
                 "error_description": "Invalid Value"
             }
             */
            let url = secrets.web.token_verify_uri +"?access_token="+ tokens.access_token;
            console.log("Verify token end-point = "+ url);
            request(url, (err, resp, respBody) => {
                //if (resp.statusCode != 200) return console.error(resp.statusMessage);
                if (err) return console.error(err.message);

                let json = JSON.parse(respBody);
                console.log("Verity access token responseBody = ", json);

                // 만료된 토큰이면
                if (json.hasOwnProperty('error')) {
                    console.log("That token is expired.");

                    let formParam = {
                        client_id: secrets.web.client_id,
                        client_secret: secrets.web.client_secret,
                        grant_type: "refresh_token",
                        refresh_token: secrets.web.refresh_token
                    };

                    // refresh token 으로 access token 새로 받기
                    console.log("Refresh access token.");
                    request.post({
                        url: secrets.web.token_uri,
                        form: formParam
                    }, (error, httpResponse, responseBody) => {
                        //if (httpResponse.statusCode != 200) return console.error(httpResponse.statusMessage);
                        if (error) return console.error(`Error on refresh access token ${error.message}`);

                        let json = JSON.parse(responseBody);
                        console.log("Refresh access token responseBody = ", json);

                        //if (json.hasOwnProperty('error')) return console.error(json.error_description);
                        if (json.hasOwnProperty('access_token')) {
                            tokens.access_token = json.access_token;
                            redis.set(redisAccessTokenKey, tokens.access_token);

                            //console.log("Refreshed access token = "+ tokens.access_token);
                            this.oAuth2Client.setCredentials(tokens);
                            this.isAuthenticated = true;
                            callback.apply();
                        }
                    });
                    // 만료되지 않은 토큰이면
                } else {
                    console.log("Token is not expired.");
                    //console.log("Access token = "+ tokens.access_token);
                    this.oAuth2Client.setCredentials(tokens);
                    this.isAuthenticated = true;
                    callback.apply();
                }
            });
        });
    }

    execute(scopes, callback) {
        if (!scopes) scopes = secrets.web.scopes;
        this._callback = callback;
        this.authenticate(scopes, callback);
    }
}

module.exports = new AuthClient();
