/**
 * 라이브 영상 공지 API 모듈
 *
 * @author cezips@gmail.com
 * @date 2016-09-08
 * @description
 *  관리 콘솔 http://console.yourdomain.com/livevideos/notice
 */
'use strict';

const redis = require('redis').createClient();

const redisLiveVideosNoticeKey = 'liveVideos:notice';

class LiveVideosNotice {
    // init
    constructor() {
        //this.phrase = "";
    }

    get() {
        return new Promise((resolve, reject) => {
            redis.get(redisLiveVideosNoticeKey, (err, reply) => {
                if (err) {
                    reject(err);
                    return console.log(err.message);
                }

                let phrase = (reply) ? reply.toString() : "";

                resolve(phrase);
            });
        });
    }
}

module.exports = new LiveVideosNotice();
