/**
 * 컨텐츠 필터
 *
 * @author cezips@gmail.com
 * @date 2016-08-03, 2016-10-13
 */
'use strict';

const Redis = require('redis');
const redis = Redis.createClient();

redis.on('error', (err) => {
    console.error(err);
});

class ContentsFilter {

    constructor() {
        // Skip filter userIds pattern
        this.skipUserIdPattern = /yourid/gi;

        // 특수문자 검증용 정규식 패턴
        this.specialcharsPattern = /[^(가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s)]/gi;

        // 비속어 검증용 정규식 패턴
        this.slangPattern = `10새|10새기|10새리|10세리|10쉐이|10쉑|10스|10쌔|10쌔기|10쎄|10알|10창|10탱|18것|18넘|18년|18노|18놈|18뇬|18럼|18롬|18새|18새끼|18색|18세끼|18세리|18섹|18쉑|18스|18아|새끼|ㄱㅐ|ㄲㅏ|ㄲㅑ|ㄲㅣ|ㅅㅂ|ㅆㅂ|ㅅㅂㄹㅁ|ㅅㅐ|ㅆㅂㄹㅁ|ㅆㅍ|ㅆㅣ|ㅆ앙|ㅍㅏ|凸|갈보|갈보년|강아지|같은년|같은뇬|개같은|개구라|개년|개놈|개뇬|개대중|개독|개돼중|개랄|개보지|개뻥|개뿔|개새|개새기|개새끼|개새키|개색기|개색끼|개색키|개색히|개섀끼|개세|개세끼|개세이|개소리|개쑈|개쇳기|개수작|개쉐|개쉐리|개쉐이|개쉑|개쉽|개스끼|개시키|개십새기|개십새끼|개쐑|개씹|개아들|개자슥|개자지|개접|개좆|개좌식|개허접|걔새|걔수작|걔시끼|걔시키|걔썌|걸레|게색기|게색끼|광뇬|구녕|구라|구멍|그년|그새끼|냄비|놈현|뇬|눈깔|뉘미럴|니귀미|니기미|니미|니미랄|니미럴|니미씹|니아배|니아베|니아비|니어매|니어메|니어미|닝기리|닝기미|대가리|뎡신|도라이|돈놈|돌아이|돌은놈|되질래|뒈져|뒈져라|뒈진|뒈진다|뒈질|뒤질래|등신|디져라|디진다|디질래|딩시|따식|때놈|또라이|똘아이|똘아이|뙈놈|뙤놈|뙨넘|뙨놈|뚜쟁|띠바|띠발|띠불|띠팔|메친넘|메친놈|미췬|미췬|미친|미친넘|미친년|미친놈|미친새끼|미친스까이|미틴|미틴넘|미틴년|미틴놈|바랄년|병자|뱅마|뱅신|벼엉신|병쉰|병신|부랄|부럴|불알|불할|붕가|붙어먹|뷰웅|븅|븅신|빌어먹|빙시|빙신|빠가|빠구리|빠굴|빠큐|뻐큐|뻑큐|뽁큐|상넘이|상놈을|상놈의|상놈이|새갸|새꺄|새끼|새새끼|새키|색끼|생쑈|세갸|세꺄|세끼|섹스|쇼하네|쉐기|쉐끼|쉐리|쉐에기|쉐키|쉑|쉣|쉨|쉬발|쉬밸|쉬벌|쉬뻘|쉬펄|쉽알|스패킹|스팽|시궁창|시끼|시댕|시뎅|시랄|시발|시벌|시부랄|시부럴|시부리|시불|시브랄|시팍|시팔|시펄|신발끈|심발끈|심탱|십8|십라|십새|십새끼|십세|십쉐|십쉐이|십스키|십쌔|십창|십탱|싶알|싸가지|싹아지|쌉년|쌍넘|쌍년|쌍놈|쌍뇬|쌔끼|쌕|쌩쑈|쌴년|썅|썅년|썅놈|썡쇼|써벌|썩을년|썩을놈|쎄꺄|쎄엑|쒸벌|쒸뻘|쒸팔|쒸펄|쓰바|쓰박|쓰발|쓰벌|쓰팔|씁새|씁얼|씌파|씨8|씨끼|씨댕|씨뎅|씨바|씨바랄|씨박|씨발|씨방|씨방새|씨방세|씨밸|씨뱅|씨벌|씨벨|씨봉|씨봉알|씨부랄|씨부럴|씨부렁|씨부리|씨불|씨붕|씨브랄|씨빠|씨빨|씨뽀랄|씨앙|씨파|씨팍|씨팔|씨펄|씸년|씸뇬|씸새끼|씹같|씹년|씹뇬|씹보지|씹새|씹새기|씹새끼|씹새리|씹세|씹쉐|씹스키|씹쌔|씹이|씹자지|씹질|씹창|씹탱|씹퇭|씹팔|씹할|씹헐|아가리|아갈|아갈이|아갈통|아구창|아구통|아굴|얌마|양넘|양년|양놈|엄창|엠병|여물통|염병|엿같|옘병|옘빙|오입|왜년|왜놈|욤병|육갑|은년|을년|이년|이새끼|이새키|이스끼|이스키|임마|자슥|잡것|잡넘|잡년|잡놈|저년|저새끼|접년|젖밥|조까|조까치|조낸|조또|조랭|조빠|조쟁이|조지냐|조진다|조찐|조질래|존나|존나게|존니|존만|존만한|좀물|좁년|좆|좁밥|좃까|좃또|좃만|좃밥|좃이|좃찐|좆같|좆까|좆나|좆또|좆만|좆밥|좆이|좆찐|좇같|좇이|좌식|주글|주글래|주데이|주뎅|주뎅이|주둥아리|주둥이|주접|주접떨|죽고잡|죽을래|죽통|쥐랄|쥐롤|쥬디|지랄|지럴|지롤|지미랄|짜식|짜아식|쪼다|쫍빱|찌랄|창녀|캐년|캐놈|캐스끼|캐스키|캐시키|탱구|팔럼|퍽큐|호로|호로놈|호로새끼|호로색|호로쉑|호로스까이|호로스키|후라들|후래자식|후레|후뢰|씨ㅋ발|ㅆ1발|씌발|띠발|띄발|뛰발|띠ㅋ발|뉘뮈|전체화면|박근혜|근혜|노무현|이명박|명박|모트라인|노사장|안녕하세요|ㅄ|ㅂㅅ|병신|최순실|순실|순시리|하야|탄핵|정유연|싼마이|노친네|병맛|SEX|색스|풀악셀|motline|일베|운지|미쳤|흉기|급발진|쓰레기|맛있겠다|맛나겠다|좆망`;

        // 최근 메세지 목록 Sets
        this.redisLatestMessagesKey = "latestMessages";
        // 최근 메세지 목록 Sets 자동소멸 시간
        this.redisLatestMessagesKeyExpireSec = 43200;   // 12시간

        // 유저의 마지막 메세지 전송 시간
        this.redisUserLastPublishedAtKey = "userLastPublishedAt";
        // 유저의 마지막 메세지 전송 시간 자동소멸 시간
        this.redisUserLastPublishedAtKeyExpireSec = 43200;   // 12시간
        // 유저의 마지막 메세지 전송 시간 내 메세지 수
        this.redisUserMessageCount = "userMessageCount";
        // 유저의 마지막 메세지 전송 시간 내 메세지 수 자동소멸 시간
        this.redisUserMessageCountExpireSec = 43200;   // 12시간
    }

    /**
     * 비속어 필터링
     *
     * @param replaceThis string
     * @returns string
     */
    slang(str, replaceThis = '') {
        if (!str) return str;

        let regExp = new RegExp(this.slangPattern, 'ig');

        return str.replace(regExp, replaceThis);
    }

    /**
     * 비속어 포함 검증
     * @param str
     * @return boolean
     */
    isHaveSlang(str) {
        if (!str) return false;

        let regExp = new RegExp(this.slangPattern, 'ig');

        return regExp.test(str);
    }

    /**
     * 특수문자 포함 검증
     * @param str
     * @return boolean
     */
    isHaveSpecialchars(str) {
        if (!str) return str;

        return this.specialcharsPattern.test(str);
    }

    /**
     * 특수문자 필터링
     * @param str string
     * @param replaceStr string
     * @return string
     */
    specialchars(str, replaceStr = '') {
        if (!str) return str;

        // 특수문자 포함 검증
        if (this.isHaveSpecialchars(str)) {
            //특수문자 제거
            str = str.replace(this.specialcharsPattern, replaceStr);
        }

        return str;
    }

    /**
     * 유저 당 기간 내 허용할 수량으로 필터링
     * @param json
     * @param quotaSec 기간, 초 단위, 정수
     * @param quotaCount 기간 내 허용할 수량, 정수
     */
    userIntimeQuota(json, quotaSec = 60, quotaCount = 5) {
        // Check source data
        if (!json || typeof json == 'undefined' || json.length < 1) return json;

        let compare = {};
        let filters = [];

        // 유저 구분자들을 별도 배열로 분리해내고
        let userIds = json.map(item => item.userName);
        let uniqueUserIds = [...new Set(userIds)]; // 중복제거

        // Check data length
        if (uniqueUserIds.length < 1) return json;

        let redisMulti = redis.multi();

        redisMulti.hmget(this.redisUserLastPublishedAtKey, uniqueUserIds);
        redisMulti.hmget(this.redisUserMessageCount, uniqueUserIds);

        return new Promise((resolve, reject) => {
            redisMulti.exec((err, replies) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }

                let [userLastPublishedAts, userMessageCounts] = replies;

                uniqueUserIds.forEach((id, i) => {
                    compare[id] = {
                        "publishedAt": userLastPublishedAts[i],
                        "messageCount": parseInt(userMessageCounts[i]) || 0
                    };
                });

                json.forEach(item => {
                    let publishedAt = item.publishedAt;
                    if (!isNaN(publishedAt)) publishedAt = new Date(parseInt(publishedAt)).toISOString();

                    let userLastPublishedAt = compare[item.userName].publishedAt;
                    let userMessageCount = compare[item.userName].messageCount || 0;

                    // 관리자 등 필터링 제외자면 Skip
                    if (item.userName.search(this.skipUserIdPattern) !== -1) {
                        compare[item.userName].publishedAt = publishedAt;
                        compare[item.userName].messageCount = 1;

                        filters.push(true);
                        return; // continue;
                    }

                    // Redis key 가 없을 경우
                    if (!userLastPublishedAt) {
                        compare[item.userName].publishedAt = publishedAt;
                        compare[item.userName].messageCount = 1;

                        filters.push(true);
                        return; // continue;
                    }

                    let calculatedTime = new Date(new Date(userLastPublishedAt).getTime() + 1000 * quotaSec).toISOString();
                    // console.log(`제한시간 이내? (${publishedAt} <= ${calculatedTime})?`);
                    // 제한시간 이내일 경우
                    if (publishedAt <= calculatedTime) {
                        // console.log(`제한 시간 이내`);
                        // console.log(`제한시간 이내 ${new Date(new Date(__userLastPublishedAt).getTime() + quotaSec).toISOString()} <= ${new Date().toISOString()}`);
                        // 메세지 수 1 추가
                        userMessageCount += 1;

                        // 유저의 메세지 수 까지 쿼터보다 작으면 허용됨으로
                        if (userMessageCount <= quotaCount) {
                            // console.log(`쿼터 수 넘지 않음. 카운트 추가.`);
                            compare[item.userName].messageCount = userMessageCount; // 메세지 수 업데이트

                            filters.push(true);
                        } else {
                            // console.log(`쿼터 수 넘음. 노출하지 않도록 false 반환.`);
                            filters.push(false);
                        }
                    }
                    // 제한 시간이 넘은 경우는 허용됨으로
                    else {
                        // console.log(`제한시간 넘음. 초기화.`);
                        compare[item.userName].publishedAt = publishedAt;
                        compare[item.userName].messageCount = 1; // 메세지 수 업데이트

                        filters.push(true);
                    }
                });

                // compare 결과를 Redis 에 한번에 저장 위해 별도 할당
                userLastPublishedAts = {};
                userMessageCounts = {};
                // console.log('compare', compare);
                for (let item in compare) {
                    userLastPublishedAts[item] = compare[item].publishedAt;
                    userMessageCounts[item] = compare[item].messageCount;
                }
                //console.log('\nuserLastPublishedAts = ', userLastPublishedAts, '\nuserMessageCounts = ', userMessageCounts);
                // compare 결과를 Redis 에 저장
                redisMulti.hmset(this.redisUserLastPublishedAtKey, userLastPublishedAts);
                redisMulti.hmset(this.redisUserMessageCount, userMessageCounts);
                redisMulti.exec((err, replies) => {
                    // console.log('Redis hmset results:\n', err, replies);
                    //redis.quit();
                });

                // console.log('filters', filters);
                let results = json.filter((item, i) => filters[i]);
                // console.log('results', results);
                return resolve(results);
            });
        });
    }

    /**
     * 메세지 중복 여부 검사
     * @param msg
     */
    isDuplication(msg) {
        if (!msg) return true;

        let checkResult = false;    // 중복됨=true | 중복안됨=false

        // 존재하는 키 값인가?
        const _isExistKey = new Promise((resolve, reject) => {
            redis.exists(this.redisLatestMessagesKey, (err, existsCount = 0) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                }

                checkResult = (existsCount > 0)? true : false;
                // console.log(`Is exists in last message queue ? ${checkResult}`);
                return resolve(checkResult);

                // 존재하지 않는 키이면 메세지를 Sets에 추가하고
                // 중복아님 반환하고 끝내기
                // if (existsCount == 0) {
                //     redis.sadd(this.redisLatestMessagesKey, msg);
                //     //redis.expire(this.redisLatestMessagesKey, this.redisLatestMessagesKeyExpireSec); // 메모리 가용성 예방
                //     return resolve(checkResult);
                // }
            });
        }); // _isExistKey

        // 메세지를 Sets에 추가
        const _add = (_msg) => {
            return new Promise((resolve, reject) => {
                redis.sadd(this.redisLatestMessagesKey, _msg, (err, result) => {
                    if (err) {
                        console.error(err);
                        return reject(err);
                    }

                    // console.log(`The message successfully added to last messages queue.`);
                    return resolve(true);
                });
            });
        }; // _add

        // 이미 기존에 전송된 메세지인가?
        const _isSent = (_msg) => {
            return new Promise((resolve, reject) => {
                redis.sismember(this.redisLatestMessagesKey, _msg, (err, setsCount = 0) => {
                    if (err) {
                        console.error(err);
                        // throw err;
                        return reject(err);
                    }

                    checkResult = (setsCount > 0)? true : false;
                    // console.log(`Is sent in last message queue ? ${checkResult}`);
                    return resolve(checkResult);
                }); // redis.sismember
            });
        }; // _isSent

        return new Promise((resolve, reject) => {
            _isSent(msg)
                .then((bSent) => {
                    if (bSent) {
                        // console.log(`_isSent.then -> resolve = ${bSent}`);
                        resolve(true);
                        return null;
                    }

                    //console.log(`Call _add();`);
                    return _add(msg);
                }, (err) => {
                    console.error(err);
                })
                .then((bAdded) => {
                    // 추가 되었으면
                    if (bAdded) {
                        //redis.expire(this.redisLatestMessagesKey, this.redisLatestMessagesKeyExpireSec); // 메모리 가용성 예방
                        // console.log(`_isSent.then -> _add.then -> resolve(false)`);
                        resolve(false);
                    }

                    // console.log(`Done`);
                });
        }); // Promise
    }

    /**
     * 메세지 중복 제거
     * @param json
     * @return Promise
     */
    uniqueMessages(json) {
        let promises = json.map((item) => {
            return this.isDuplication(item.message);
        });

        return Promise.all(promises)
            .then((results) => {
                return json.filter((item, i) => !results[i]);
            }).catch((err) => {
                throw err;
            });
    }

    /**
     * 메세지 수 카운팅
     * @param json
     * @param findField
     * @param findVal
     * @return Integer
     */
    countUserMessage(json, findField, findVal) {
        if (!json || !findField || !findVal) {
            let errorMessages = [];

            if (!json) {
                errorMessages.push('json');
            }
            if (!findField) {
                errorMessages.push('findField');
            }
            if (!findVal) {
                errorMessages.push('findVal');
            }

            if (errorMessages.length > 0) {
                // throw new Error(`parameter ${errorMessages.join(',')} required`);
                return 0;
            }
        }

        let founds = json.filter((item) => item[findField] == findVal);

        return founds.length;
    }
}


module.exports = new ContentsFilter();