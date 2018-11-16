/**
 * Youtube 라이브 방송
 * @date 2016. 7. 19
 * @author cezips@gmail.com
 * @description
 * https://developers.google.com/youtube/v3/live/docs/liveBroadcasts
 */
'use strict';

const google = require('googleapis');
const authClient = require(__base +'helpers/googleAuthClient');
const redis = require('redis').createClient();
const util = require('util');

const youtube = google.youtube({
    version: 'v3',
    auth: authClient.oAuth2Client
});

/**
 * Youtube 라이브 방송
 */
class LiveBroadcast {
    constructor() {
        this.id = null;
    }

    /**
     * 라이브 방송 목록 조회
     * https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/list
     * @returns {Promise}
     */
    list() {
        return new Promise((resolve, reject) => {
            authClient.execute(null, () => {
                youtube.liveBroadcasts.list(
                    {
                        part: 'id,snippet,contentDetails,status',
                        broadcastStatus: 'all'
                    },
                    (error, response) => {
                        if (error) {
                            reject({ message: error.message });
                            return console.error('LiveBroadcast.list error !! ', error.message);
                        }

                        /* 응답 오류를 쓰고 싶다면 중복 해제
                         if (!response) {
                         error.message = 'No response data at LiveBroadcast.list';
                         throw new Error(error.message);
                         return reject(error.message);
                         }*/

                        resolve(response);
                    }
                );
            });
        });
    }

    get(id) {
        return new Promise((resolve, reject) => {
            if (!id) {
                reject({ message: 'LiveBroadcast.get() id required' });
                return console.error('LiveBroadcast.get() id required');
            }

            authClient.execute(null, () => {
                youtube.liveBroadcasts.list(
                    {
                        part: 'id,snippet,contentDetails,status',
                        id: id
                    },
                    (error, response) => {
                        if (error) {
                            //throw new Error('LiveBroadcast.get() '+ error.message);
                            return reject({ message: error.message });
                        }

                        if (!response) {
                            error.message = 'No response data at LiveBroadcast.list';
                            return reject(error.message);
                        }

                        if (!response.items[0].snippet.hasOwnProperty('liveChatId')) {
                            resolve([]);
                            return console.error('LiveBroadcast.get(id) video does not have live chat');
                        }

                        resolve(response.items[0]);
                    }
                );
            });
        });
    }

    getLatestLiveBroadcastHavingLiveChat() {
        return new Promise((resolve, reject) => {
            authClient.execute(null, () => {
                this.list()
                    .then((response) => {
                        let [json, item, liveChatId] = [response, null, ""];

                        for (let i = 0; i < json.items.length; i++) {
                            item = json.items[i];

                            if (item.snippet.hasOwnProperty('liveChatId')) {
                                liveChatId = item.snippet.liveChatId;
                                //console.log('Latest broadcast liveChatId = ' + liveChatId);
                                break;
                            }
                        }

                        if (!liveChatId) {
                            reject({ message: `youtube.getLatestLiveBroadcastHavingLiveChat() live chat id not exist.` });
                            return;
                        }

                        resolve(item);
                    })
                    .catch((error) => {
                        reject({ message: error.message });
                    });
            });
        });
    }
}

module.exports = new LiveBroadcast();