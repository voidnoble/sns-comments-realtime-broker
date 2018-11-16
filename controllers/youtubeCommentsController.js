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

'use strict';

const google = require('googleapis'),
    authClient = require(__base +'helpers/googleAuthClient'),
    secrets = require(__base +'config/secrets.json'),
    CommentModel = require(__base +'models/comment'),
    util = require('util');

var comments = [];

// initialize the Youtube API library
var youtube = google.youtube({
    version: 'v3',
    auth: authClient.oAuth2Client
});

function getCommentThreadslistData(callback) {
    youtube.commentThreads.list({
        part: 'id,replies,snippet',
        videoId: 'TmqBSGyNgYk',
        publishedAfter: '2016-07-13T09:40:00.000Z'
    }, function (err, data, response) {
        if (err) {
            return console.error('Error: ' + err);
        }

        let json = data,
            item = null,
            commentModel = null;

        if (data) {
            //console.log(util.inspect(data, false, null));

            for (let i = 0; i < json.items.length; i++) {
                item = json.items[i];
                //item.id : comment Thread id
                //item.snippet.topLevelComment.id
                //item.snippet.topLevelComment.snippet.likeCount
                //item.snippet.topLevelComment.snippet.totalReplyCount
                //item.replies.comments : array
                //item.replies.comments.id : Comment
                //item.replies.comments.snippet.authorDisplayName

                // 코멘트 객체에 데이터 할당
                commentModel = new CommentModel();
                commentModel.origin = "youtube";
                commentModel.kind = "comment";
                commentModel.id = item.snippet.topLevelComment.id;
                commentModel.userName = item.snippet.topLevelComment.snippet.authorDisplayName;
                commentModel.userImage = item.snippet.topLevelComment.snippet.authorProfileImageUrl;
                commentModel.messageOriginal = item.snippet.topLevelComment.snippet.textDisplay;
                commentModel.message = commentModel.messageOriginal;
                commentModel.publishedAt = item.snippet.topLevelComment.snippet.publishedAt;
                commentModel.updatedAt = item.snippet.topLevelComment.snippet.updatedAt;

                // 포맷팅
                commentModel.message = commentModel.message.replace(/[\u200B-\u200D\uFEFF]/g, '');
                commentModel.message = commentModel.message.replace(/<[^>]+>/ig, '');

                // 코멘트 객체들 배열에 추가
                comments.push(commentModel);
                commentModel = null;
            }

            // util.inspect() 는 object 를 디버깅용 string 형태로 반환
            console.log(util.inspect(comments, false, null));
        }

        if (response) {
            console.log('Status code: ' + response.statusCode);
        }

        callback(err, data, response, json.items.length);
    });
}

function getCommentslistData(etag, callback) {
    // Create custom HTTP headers for the request to enable
    // use of eTags
    var headers = {};
    if (etag) {
        headers['If-None-Match'] = etag;
    }
    youtube.comments.list({
        part: 'id,snippet',
        id: 'PLIivdWyY5sqIij_cgINUHZDMnGjVx3rxi',
        headers: headers
    }, function (err, data, response) {
        if (err) {
            console.error('Error: ' + err);
        }

        if (data) {
            console.log(util.inspect(data, false, null));
        }

        if (response) {
            console.log('Status code: ' + response.statusCode);
        }

        callback(err, data, response);
    });
}

function fetch() {
    getCommentThreadslistData((err, data, response) => {
        if (err) {
            return console.log(err);
        }

        console.log(response.status);
    });
}

function main() {
    authClient.execute(secrets.web.scopes, fetch);
}

exports.main = main;
