/**
 * Youtube 라이브 채팅
 * @date 2016-07-18
 * @author cezips@gmail.com
 * @description
 * https://developers.google.com/youtube/v3/live/docs/liveChatMessages
 */
const google = require('googleapis');
const authClient = require(__base +'helpers/googleAuthClient');
const redis = require('redis').createClient();
const CommentModel = require(__base +'models/comment');
const liveBroadcast = require(__base +'controllers/googleLiveBroadcast');
const util = require('util');

const redisYoutubeLastPollingAtKey = "youtube_last_polling_at";

const youtube = google.youtube({
    version: 'v3',
    auth: authClient.oAuth2Client
});

class LiveChat {
    constructor() {
        this.videoId = "";
        this.liveChatId = "";
        this.force = "no";
        this.items = [];
    }

    list(queryString) {
        return new Promise((resolve, reject) => {
            this.videoId = queryString.videoId;
            this.liveChatId = queryString.liveChatId;
            this.force = queryString.force;

            authClient.execute(null, () => {
                // LiveChatId 로 채팅 items 조회
                if (this.liveChatId) {
                    this.getListWithLiveChatId(this.liveChatId, (list) => {
                        resolve(list);
                    });
                    return;
                }

                // VideoId 로 채팅 items 조회
                if (this.videoId) {
                    // 라이브 영상 데이터 조회
                    liveBroadcast.get(this.videoId)
                        .then((response) => {
                            if (response.length < 1) {
                                resolve([]);
                                return;
                            }

                            // LiveChatId 로 채팅 items 조회
                            this.getListWithLiveChatId(response.snippet.liveChatId, (list) => {
                                resolve(list);
                            });
                            return;
                        });
                }

                // 라이브 채팅이 있는 최근의 라이브 방송 조회
                liveBroadcast.getLatestLiveBroadcastHavingLiveChat()
                    .then((response) => {
                        //console.log('youtube.liveBroadcasts.list response = ', response);

                        // LiveChatId 로 채팅 items 조회
                        this.getListWithLiveChatId(response.snippet.liveChatId, (list) => {
                            resolve(list);
                        });
                        return;
                    })
                    .catch((error) => {
                        resolve([]);
                        return console.error(error.message);
                    });

            });
        });
    }

    getListWithLiveChatId(liveChatId, callback) {
        // 라이브 채팅 목록 조회
        youtube.liveChatMessages.list({
            liveChatId: liveChatId,
            part: 'id,snippet,authorDetails',
            hl: 'ko'
        }, (err, response) => {
            if (err) {
                return console.error(err);
            }

            //console.log('Live Chat list = ', response);

            if (response.items.length < 1) {
                return console.log('Live Chat list does not exist.');
            }

            redis.get(redisYoutubeLastPollingAtKey, (err, reply) => {

                let [commentModel, itemPublishedAt, liveChatItems, item] = [null, null, [], null];
                let lastPollingAt = (reply) ? reply.toString() : "";
                let dateLastPollingAt = (lastPollingAt) ? new Date(lastPollingAt) : "";

                /* response.items 정렬은 publishedAt ASC 순
                 livechat item = {
                 "kind": "youtube#liveChatMessage",
                 "etag": "\"5g01s4-wS2b4VpScndqCYc5Y-8k/0JoB41-TNEr67rB9yh7Zp4xJqoA\"",
                 "id": "LCC.Cg8KDQoLbGNPRmRFazFnLWsSSQoaQ015TzRxVFZfTTBDRmNHanZnb2Q1OEVLancaK2ZscFR4U2xyZ2tZbkgtd2psMUM1X1J5TVRWWk14aE8yUXB6bURpSFpHYWc",
                 "snippet": {
                 "type": "textMessageEvent",
                 "liveChatId": "Cg0KC2xjT0ZkRWsxZy1r",
                 "authorChannelId": "UCp0B9n0YYC8E8bJmS5i4oqw",
                 "publishedAt": "2016-07-18T09:09:49.873Z",
                 "hasDisplayContent": true,
                 "displayMessage": "테스트아아",
                 "textMessageDetails": {
                 "messageText": "테스트아아"
                 }
                 },
                 "authorDetails": {
                 "channelId": "UCp0B9n0YYC8E8bJmS5i4oqw",
                 "channelUrl": "http://www.youtube.com/channel/UCp0B9n0YYC8E8bJmS5i4oqw",
                 "displayName": "",
                 "profileImageUrl": "https://yt3.ggpht.com/-yyzHt7Tsv8g/AAAAAAAAAAI/AAAAAAAAAAA/kOjjxdlJyp4/s88-c-k-no-rj-c0xffffff/photo.jpg",
                 "isVerified": false,
                 "isChatOwner": true,
                 "isChatSponsor": false,
                 "isChatModerator": false
                 }
                 }
                 */
                response.items.reverse();   // 데이터들 정렬을 시간 DESC 로

                for (let i = 0; i < response.items.length; i++) {
                    item = response.items[i];

                    if (lastPollingAt && this.force != "yes") {
                        itemPublishedAt = new Date(item.snippet.publishedAt);

                        // 최근 Polling 시간과 비교해서 기존에 가져왔던 데이터이면 루프 끝내기
                        if (itemPublishedAt.getTime() <= dateLastPollingAt.getTime()) break;
                    }

                    // 채팅 모델 생성
                    commentModel = new CommentModel();
                    commentModel.id = item.id;
                    commentModel.origin = "youtube";
                    commentModel.kind = "chat";
                    commentModel.userName = item.authorDetails.displayName;
                    commentModel.userImage = item.authorDetails.profileImageUrl;
                    commentModel.messageOriginal = item.snippet.displayMessage;
                    commentModel.message = commentModel.messageOriginal;
                    commentModel.publishedAt = item.snippet.publishedAt;

                    // 포맷팅
                    //commentModel.message = commentModel.message.replace(/[\u200B-\u200D\uFEFF]/g, '');
                    commentModel.message = commentModel.message.replace(/<[^>]+>/ig, '');

                    // 채팅 배열에 쌓기
                    liveChatItems.push(commentModel);
                    commentModel = null;
                }

                if (liveChatItems.length > 0 && this.force != "yes") {
                    // 가장 마지막 item 날짜를 polling 했던 날짜 캐시에 저장
                    redis.set(redisYoutubeLastPollingAtKey, liveChatItems[0].publishedAt);
                }

                // 결과를 콜백함수 받았던것에 인자로 반환
                return callback(liveChatItems);
            });
        });
    }
}

module.exports = new LiveChat();
