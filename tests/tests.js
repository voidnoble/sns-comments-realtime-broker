global.__base = __dirname + '/../';

const chai  = require('chai');
const assert  = chai.assert;
const expect  = chai.expect;
const fs = require('fs');
const redis = require('redis').createClient();
const Comments = require(__dirname +'/../models/comments');
const contentsFilter = require(__dirname +'/../helpers/contentsFilter');

redis.on('error', (err) => {
    throw err;
});

let data = {
    "default": JSON.parse(fs.readFileSync(__dirname +'/comments.json')),
    "slang": {},
    "continues1": JSON.parse(fs.readFileSync(__dirname +'/continues1.json')),
    "continues2": JSON.parse(fs.readFileSync(__dirname +'/continues2.json')),
    "continues2step2": JSON.parse(fs.readFileSync(__dirname +'/continues2-2.json')),
    "quota": JSON.parse(fs.readFileSync(__dirname +'/quota.json')),
    "continues": JSON.parse(fs.readFileSync(__dirname +'/continues.json'))
};


describe('데이터 스트림 검증', () => {
    describe('# 일반', () => {
        it('* 데이터는 null 이 아닐것', () => {
            expect(data.default).not.equal(null);
            //assert(data.default != null, '데이터는 null 이 아니다');
        });

        it('* 데이터 수 0 보다 클것', () => {
            expect(data.default).have.length.above(0);
        });
    });
});

describe('반복 검증', () => {
    it('* 데이터는 null 이 아닐것', () => {
        expect(data.continues).not.equal(null);
    });

    it('* 데이터 수 0 보다 클것', () => {
        expect(data.continues).have.length.above(0);
    });

    it('* continues1.json 중복검사 1회차는 "안녕하세요" 1개 반환', (done) => {
        // initialize cache
        redis.del(contentsFilter.redisLatestMessagesKey);

        let comments = new Comments(data.continues1);
        comments = comments.unique();

        contentsFilter.uniqueMessages(comments).then((uniqueMessageComments) => {
            assert.equal(uniqueMessageComments.length, 1);
            assert.equal(uniqueMessageComments[0].message, "안녕하세요");

            done();
        });
    });

    it('* continues1.json 중복검사 2회차는 빈 배열 반환', (done) => {
        let comments = new Comments(data.continues1);
        comments = comments.unique();

        contentsFilter.uniqueMessages(comments).then((uniqueMessageComments) => {
            assert.equal(uniqueMessageComments.length, 0);

            done();
        });
    });

    it('* "뭐가 3위?"는 한번만 나와야', (done) => {
        // initialize cache
        redis.del(contentsFilter.redisLatestMessagesKey);

        let promises = [];

        data.continues2.forEach((item, i, items) => {
            promises.push( contentsFilter.isDuplication(item.message) );
        });

        Promise.all(promises).then((results) => {
            let continues = data.continues2.filter((item, i) => {
                return !results[i];
            });

            assert.equal(continues[0].message, "뭐가 3위?");

            done();
        }, (error) => {
            console.log(error);
        });
    });

    it('* "뭐가 3위?" 반복 블럭 확인', (done) => {
        let promises = [];

        data.continues2step2.forEach((item, i, items) => {
            promises.push( contentsFilter.isDuplication(item.message) );
        });

        Promise.all(promises).then((results) => {
            let continues = data.continues2step2.filter((item, i) => {
                return !results[i];
            });

            assert.notEqual(continues[0].message, "뭐가 3위?");

            done();
        }, (error) => {
            console.log(error);
        });
    });

});

describe('유저별 시간 내 메세지 쿼터 검증', () => {
    it('userIntimeQuota()', (done) => {
        let comments = new Comments(data.quota);
        comments = comments.orderByPublishedAtAsc(); // 시간순 정렬

        // Redis 쿼터 검증 관련 데이터 초기화
        let redisMulti = redis.multi();
        redisMulti.del(contentsFilter.redisUserLastPublishedAtKey);
        redisMulti.del(contentsFilter.redisUserMessageCount);
        redisMulti.exec((err, replies) => {
            if (err) {
                console.error(err);
                return;
            }

            contentsFilter.userIntimeQuota(comments, 60, 3).then((res) => {
                // console.log(res);
                assert.equal(res[res.length - 1].id, "1654820");

                done();
            }, (error) => {
                console.error(error);

                done();
            });
        });
    });
});
