/**
 * 페이스북 페이지 가장 최근 라이브 영상 코멘트 로딩
 * @author yj.kwak
 * @date 2016. 7. 19
 * @description
 *  https://github.com/Thuzi/facebook-node-sdk
 */
'use strict';

const FB = require('fb');
const secrets = require(__base +'config/secrets.json');
const redis = require('redis').createClient();
const CommentModel = require(__base +'models/comment');

const redisFacebookLastPollingAtKey = "facebook_last_polling_at";

class FacebookLiveVideoComments {

    constructor() {
        // 아래 둘 중 하나로 액세스 토큰 셋팅
        FB.options({accessToken: secrets.facebook.page_token});
        //FB.setAccessToken(secrets.facebook.page_token);

        this.pageId = "142093499335158";
    }

    list(queryString) {
        return new Promise((resolve, reject) => {
            // Get Live videos
            // 레퍼런스 = https://developers.facebook.com/docs/graph-api/reference/live-video/
            // API End-point = https://graph.facebook.com/v2.6/142093499335158/live_videos?access_token=
            FB.api('/v2.6/'+ this.pageId +'/live_videos', { fields: 'id,title,status,live_views' }, (res) => {
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

                // 라이브 영상 코멘트 목록 조회 - 정렬: 시간 역순
                FB.api(`/v2.6/${video.id}/comments`, { order: 'reverse_chronological' }, (res) => {
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

                    let [json, item, comments] = [res.data, null, []];

                    if (res.data.length < 1) {
                        resolve(comments);
                        return console.error("Live video not exists");
                    }

                    redis.get(redisFacebookLastPollingAtKey, (err, reply) => {

                        let [commentModel, itemPublishedAt] = [null, null];
                        let lastPollingAt = (reply) ? reply.toString() : "";
                        let dateLastPollingAt = (lastPollingAt)? new Date(lastPollingAt) : "";

                        /*
                        livechat item = {
                             "created_time": "2016-07-19T07:40:39+0000",
                             "from": {
                                "name": "송영우",
                                "id": "1812827058950172"
                             },
                             "message": "김기자님 김다혜기자가 훨나요?",
                             "id": "524859361058568_524860104391827"
                         }
                         */
                        for (let i = 0; i < json.length; i++) {
                            item = json[i];

                            if (lastPollingAt && queryString.force != "yes") {
                                itemPublishedAt = new Date(item.created_time);

                                // 최근 Polling 시간과 비교해서 기존에 가져왔던 데이터이면 루프 끝내기
                                if (itemPublishedAt.getTime() <= dateLastPollingAt.getTime()) break;
                            }

                            // 채팅 모델 생성
                            commentModel = new CommentModel();
                            commentModel.id = item.id;
                            commentModel.origin = "facebook";
                            commentModel.kind = "comment";
                            commentModel.userName = item.from.name;
                            commentModel.userImage = "http://graph.facebook.com/v2.6/"+ item.from.id +"/picture";
                            commentModel.messageOriginal = item.message;
                            commentModel.message = commentModel.messageOriginal;
                            commentModel.publishedAt = item.created_time;

                            // 포맷팅
                            //commentModel.message = commentModel.message.replace(/[\u200B-\u200D\uFEFF]/g, '');
                            commentModel.message = commentModel.message.replace(/<[^>]+>/ig, '');

                            // 채팅 배열에 쌓기
                            comments.push(commentModel);
                            commentModel = null;
                        }

                        if (comments.length > 0 && queryString.force != "yes") {
                            // 가장 마지막 item 날짜를 polling 했던 날짜 캐시에 저장
                            redis.set(redisFacebookLastPollingAtKey, comments[0].publishedAt);
                        }

                        // 호출.then(res) 에서 받을 수 있도록 Promise resolve
                        resolve(comments);
                    });
                });
            });
        });
    }
}

module.exports = new FacebookLiveVideoComments();