/**
 * 페이스북 라이브 영상
 *
 * @author cezips@gmail.com
 * @date 2016-07-28
 */
'use strict';

const FB = require('fb');
const secrets = require(__base +'config/secrets.json');

class FacebookLiveVideos {

    constructor() {
        // 아래 둘 중 하나로 액세스 토큰 셋팅
        FB.options({accessToken: secrets.facebook.page_token});
        //FB.setAccessToken(secrets.facebook.page_token);
    }

    /**
     * Live 영상 목록
     *
     * @description
     * json sample:
     * {
          "data": [
            {
              "id": "525535624324275",
              "title": "MG 생방송 - 아우디 A4편",
              "status": "VOD",
              "live_views": 0
            },
            {
              "id": "524859364391901",
              "title": "MG 생방송 - 쿠가(Ford Kuga)편",
              "status": "LIVE_STOPPED",
              "live_views": 0
            }
          ]
       }
     */
    list(queryString) {
        return new Promise((resolve, reject) => {
            // Get Live videos
            // 레퍼런스 = https://developers.facebook.com/docs/graph-api/reference/live-video/
            // API End-point = https://graph.facebook.com/v2.6/142093499335158/live_videos?access_token=
            FB.api('/v2.6/142093499335158/live_videos', { fields: 'id,title,status,live_views' }, (res) => {
                if (res && res.error) {
                    if (res.error.code == 'ETIMEDOUT') {
                        console.error('error', 'request timeout');
                    }
                    else {
                        console.error('error', res.error);
                    }

                    reject(res.error);
                    return;
                }

                // 라이브 영상이 하나도 없으면 빈 배열 반환
                if (res.data.length < 1) {
                    resolve([]);
                    return console.error("Live video list empty.");
                }

                /*
                 res.data = [
                 {
                 "title": "MG 생방송 - 아우디 A4편",
                 "status": "LIVE",
                 "embed_html": "<iframe src=\"https://www.facebook.com/video/embed?video_id=525535620990942\" width=\"832\" height=\"468\" frameborder=\"0\"></iframe>",
                 "id": "525535624324275"
                 },
                 {
                 "title": "MG 생방송 - 쿠가(Ford Kuga)편",
                 "status": "LIVE_STOPPED",
                 "embed_html": "<iframe src=\"https://www.facebook.com/video/embed?video_id=524859361058568\" width=\"832\" height=\"468\" frameborder=\"0\"></iframe>",
                 "id": "524859364391901"
                 },
                 {
                 "title": "MG 생방송 - 쿠가(Ford Kuga)편",
                 "status": "VOD",
                 "embed_html": "<iframe src=\"https://www.facebook.com/video/embed?video_id=524856947725476\" width=\"400\" height=\"224\" frameborder=\"0\"></iframe>",
                 "id": "524856951058809"
                 }
                 ]
                 */
                // res.data 루프 돌며 res.data[i].status 값이 "LIVE"인 item 을 현재 라이브 방송 영상 변수 값으로 할당
                let [video, videoItem, videoStatus] = [null, null, "LIVE"];

                if (queryString.hasOwnProperty('status')) {
                    videoStatus = queryString.status.toUpperCase();
                }

                if (videoStatus == "LATEST") {
                    video = res.data[0];
                } else {
                    for (let i = 0; i < res.data.length; i++) {
                        videoItem = res.data[i];
                        if (videoItem.status == videoStatus) {
                            video = videoItem;
                            break;
                        }
                    }
                }

                // 라이브중인 영상이 없으면 빈 배열 리턴
                if (!video) {
                    resolve([]);
                    return console.error("Live video not exist.");
                }

                resolve(video);
            });
        });
    }
}

module.exports = new FacebookLiveVideos();
