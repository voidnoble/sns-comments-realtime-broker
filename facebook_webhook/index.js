/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

const bodyParser = require('body-parser'),
	https = require('https'),
	express = require('express'),
	xhub = require('express-x-hub'),
	fs = require('fs');

const credentials = {
	key: fs.readFileSync('/home/ssl/wildcard.yourdomain.com_sha2/_wildcard_yourdomain_com_SHA256WITHRSA.key'),
	cert: fs.readFileSync('/home/ssl/wildcard.yourdomain.com_sha2/chainedSSL.crt')
};

const app = express();

app.set('port', (process.env.PORT || 5000));
//app.set('portSSL', (process.env.PORTSSL || 5443));
app.set('appSecret', (process.env.APP_SECRET));

app.listen(app.get('port'), () => {
	console.log("Express HTTP server listening on port 5000");
});

/*const httpsServer = https.createServer(credentials, app).listen(app.get('portSSL'), () => {
	console.log("Express HTTPS server listening on port "+ app.get('portSSL'));
});*/

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

app.get('/', function(req, res) {
  console.log(req);
  res.send('It works!');
});

app.get(['/facebook', '/instagram'], function(req, res) {
  if (
    req.query["hub.mode"] == 'subscribe' &&
    req.query["hub.verify_token"] == 'token'
  ) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:');

  if (req.isXHub) {
    console.log('request header X-Hub-Signature found, validating');
    if (req.isXHubValid()) {
      console.log('request header X-Hub-Signature validated');
      res.send('Verified!\n');
    }
  }
  else {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.send('Failed to verify!\n');
    // recommend sending 401 status in production for non-validated signatures
    // res.sendStatus(401);
  }
  console.log(req.body);

  // Send message to MG Slack #facebook channel
  let slackRequestOptions = {
	hostname: 'https://hooks.slack.com',
	port: 80,
	path: '/services/xxxxxx/xxxxxx/xxxxxxxxxxxxxxx',
	headers: {
	  'Content-Type': 'application/x-www-form-urlencoded'
	}
  };

  let slackRequest = https.request(slackRequestOptions, (slackResponse) => {
	console.log(`STATUS: ${slackResponse.statusCode}`);
	console.log(`HEADERS: ${JSON.stringify(slackResponse.statusCode)}`);
	slackResponse.setEncoding('utf8');
	slackResponse.on('data', (chunk) => {
	  console.log(`BODY: ${chunk}`);
	});
	slackResponse.on('end', () => {
	  console.log('No more data in response from the Slack.');
	});
  });

  slackRequest.on('error', (e) => {
    console.log(`Problem with request: ${e.message}`);
  });

  slackRequest.write('{"channel": "#facebook", "username": "FacebookWebhooks Bot", "text": "This is posted to #facebook and comes from a bot named FacebookWebhookBot."}');
  slackRequest.end();

  // Process the Facebook updates here
  res.sendStatus(200);
});

app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  res.sendStatus(200);
});

app.listen();
