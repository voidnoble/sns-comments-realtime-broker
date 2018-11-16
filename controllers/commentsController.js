/**
 * @author yj.kwak
 * @date 2016-10-19
 */
'use strict';

const facebookComments = require(__base +'controllers/facebookCommentsController');
const facebookPandoratvComments = require(__base +'controllers/facebookPandoratvCommentsController');
const liveChat = require(__base +'controllers/googleLiveChat');
const afreecatvChat = require(__base +'controllers/afreecatvChatController');
const Comments = require(__base +'models/comments');
const contentsFilter = require(__base +'helpers/contentsFilter');

class CommentsController {
    constructor() {
    }

    index(req, res) {
        let promiseList = [
            facebookComments.list(req.query),
            liveChat.list(req.query),
            afreecatvChat.list(req.query),
            facebookPandoratvComments.list(req.query),
        ];

        Promise.all(promiseList).then((result) => {  // 모두 로딩되었을 때
            // results is an array of the values stored in [] parameters

            // 결과를 합치기
            let json = result[0].concat(result[1]).concat(result[2]);

            // CSV 형식 응답 요청시
            if (req.query.format == "csv") {
                let comments = new Comments(json);

                comments.json = comments.orderByPublishedAtDesc();

                // 필터링
                comments.json = comments.json.map((item) => {
                    // 특수문자 필터링
                    item.userName = contentsFilter.specialchars(item.userName, '');
                    item.message = contentsFilter.specialchars(item.message, '');

                    return item;
                });

                // 비속어 포함되지 않은 의견들만 남기기
                comments.json = comments.json.filter((item) => {
                    return !contentsFilter.isHaveSlang(item.message);
                });

                /*// 메세지 중복 제거
                comments.json = comments.unique();
                contentsFilter.uniqueMessages(comments.json)
                    .then((comments) => {
                        return contentsFilter.userIntimeQuota(comments, req.query.quotaSec, req.query.quotaCount);
                    })
                    .then((data) => {
                        comments.json = data;

                        // Print out the results
                        res.send(comments.toCSV());
                    })
                    .catch((err) => {
                        console.error(err);
                    });
                */
                // 메세지 중복 제거 하지 않고 출력시 아래 주석 풀고 위 블럭 주석처리
                res.send(comments.toCSV());
            }
            // JSON 형식 응답 요청시 (기본값)
            else {
                // Print out the results
                res.send(json);
            }
        }, (err) => {
            //TODO: 하나 이상 실패했을 때
            res.send(err);
        });
    }
}

module.exports = new CommentsController();