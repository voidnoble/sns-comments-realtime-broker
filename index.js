/**
 * 라이브 방송 댓글 브로커
 *
 * @author cezips@gmail.com
 * @description
 * - Youtube, Facebook, 아프리카TV 등의 라이브 방송 지원 서비스에서
 *   라이브 방송의 채팅이나 댓글을 요구되는 모델로 생산하고 소비하게 하는 브로커.
 * - OAuth 2 Callback process 들이 주로 사용되었음.
 */
global.__base = __dirname + '/';

const express = require('express');
const app = express();
const request = require('request');
const redis = require('redis').createClient();
const secrets = require('./config/secrets.json');
const contentsFilter = require('./helpers/contentsFilter');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/data/' });

// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
    let corsAllowedOrigins = ["http://console.yourdomain.local", "http://console.yourdomain.com", "https://console.yourdomain.com", "https://console.yourdomain.co.kr", "https://console.yourdomain.net", "https://callback.yourdomain.com"];

    let origin = req.headers.origin;

    if (corsAllowedOrigins.indexOf(origin) > -1) {
        //console.log('Allow CORS');
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header('Access-Control-Expose-Headers', 'Etag, Authorization, Origin, X-Requested-With, Content-Type, Accept, If-None-Match, Access-Control-Allow-Origin, phpdebugbar, phpdebugbar-id');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    }

    next();
});

// Routings

app.get('/', (req, res) => {
	res.send('Hello world!');
});

/**
 * 라이브 영상 공지
 */
app.get('/livevideos/notice', (req, res) => {
    const liveVideosNotice = require('./controllers/noticeController');

    liveVideosNotice.get()
        .then((response) => {
            res.send(response);
        })
        .catch((error) => {
            console.log(error);
        });
});

/**
 * 라이브 영상 자막 배경 업로드 파일 처리
 */
let uploadFields = upload.fields([
    { name: 'subtitle_background_youtube', maxCount: 1 },
    { name: 'subtitle_background_facebook', maxCount: 1 },
    { name: 'subtitle_background_afreecatv', maxCount: 1 },
]);
app.post('/livevideos/captions/backgrounds', uploadFields, (req, res) => {
    let files = {
        "youtube": {},
        "facebook": {},
        "afreecatv": {}
    };

    let acceptMimePattern = /(png|jpg|jpeg|gif)/;
    let fileExtention = '';

    if (req.files['subtitle_background_youtube']) {
        files.youtube = req.files['subtitle_background_youtube'][0];

        if (acceptMimePattern.test(files.youtube.mimetype)) {
            //console.log(files.youtube);
            fileExtention = files.youtube.mimetype.replace('image/', '.').replace('jpeg', 'jpg');
            fs.renameSync(files.youtube.path, __dirname + '/../images/' + files.youtube.fieldname + fileExtention);

            files.youtube.success = true;
            files.youtube.message = 'OK';
        } else {
            files.youtube.success = false;
            files.youtube.message = '업로드 가능한 파일 형식이 아닙니다.';
        }
    }

    if (req.files['subtitle_background_facebook']) {
        files.facebook = req.files['subtitle_background_facebook'][0];

        if (acceptMimePattern.test(files.facebook.mimetype)) {
            //console.log(files.facebook);
            fileExtention = files.facebook.mimetype.replace('image/', '.').replace('jpeg', 'jpg');
            fs.renameSync(files.facebook.path, __dirname + '/../images/' + files.facebook.fieldname + fileExtention);

            files.facebook.success = true;
            files.facebook.message = 'OK';
        } else {
            files.facebook.success = false;
            files.facebook.message = '업로드 가능한 파일 형식이 아닙니다.';
        }
    }

    if (req.files['subtitle_background_afreecatv']) {
        files.afreecatv = req.files['subtitle_background_afreecatv'][0];

        if (acceptMimePattern.test(files.afreecatv.mimetype)) {
            //console.log(files.afreecatv);
            fileExtention = files.afreecatv.mimetype.replace('image/', '.').replace('jpeg', 'jpg');
            fs.renameSync(files.afreecatv.path, __dirname + '/../images/' + files.afreecatv.fieldname + fileExtention);

            files.afreecatv.success = true;
            files.afreecatv.message = 'OK';
        } else {
            files.afreecatv.success = false;
            files.afreecatv.message = '업로드 가능한 파일 형식이 아닙니다.';
        }
    }

    res.json({ "success": true, "message": "Upload finish!", "files": files });
});

/**
 * 의견들 모듬
 */
const commentsController = require('./controllers/commentsController');
app.get('/comments', commentsController.index);

/**
 * 구글
 */
app.get('/google', (req, res) => {
	// 구글로부터 인증코드를 받았다면
	// access token 로 교환
	if (req.query.code) {
		request.post({
			url: secrets.web.token_uri,
			form: {
				code: req.query.code,
				client_id: secrets.web.client_id,
				client_secret: secrets.web.client_secret,
				redirect_uri: secrets.web.redirect_uris[0],
				grant_type: "authorization_code"
			}
		}, (err, httpResponse, responseBody) => {
			if (err) {
				return console.error('Failed to exchange authorization code for refresh and access tokens', err);
			}
			
			// Save to memory db
			redis.set("google_access_token", JSON.stringify(responseBody));
			
			// temp process: print result
			res.send(responseBody);
		});
	}
});

/**
 * 페이스북
 */
app.get('/facebook', (req, res) => {
	res.send('MG API callback for Facebook.');
});

/**
 * 페이스북 라이브 영상 조회
 */
app.get('/facebook/live_videos', (req, res) => {
    const facebookLiveVideos = require('./controllers/facebookLiveVideosController');

    facebookLiveVideos.list(req.query).then((response) => {
        if (!response) {
            console.error(`No response fetch facebook live videos.`);
            return;
        }

        let video = response;

        res.send(video);
    });
});

/**
 * 페이스북 라이브 영상 시청자 수 조회
 */
app.get('/facebook/live_videos/live_views', (req, res) => {
    const facebookLiveVideos = require('./controllers/facebookLiveVideosController');

    facebookLiveVideos.list(req.query).then((response) => {
        if (!response) {
            console.error(`No response fetch facebook live videos.`);
            return;
        }

        let video = response;

        res.send(200, video.live_views);   // 생방송 시청자 수
    });
});

/**
 * 페이스북 의견들
 */
app.get('/facebook/comments', (req, res) => {
	const facebookComments = require('./controllers/facebookCommentsController');

    facebookComments.list(req.query)
        .then((response) => {
            let json = response;

            if (req.query.format == "csv") {
                let subtitles = [];
                let subtitle = "";
                let item = null;
                let publishedDate = null;
                let publishedTimestamp = "";
                let background = "";

                // 데이터 루프 최대 건수 제한
                let itemLength = (json.length > 9)? 9 : json.length;

                for (let i = 0; i < itemLength; i++) {
                    item = json[i];

                    publishedDate = new Date(item.publishedAt);
                    publishedTimestamp = publishedDate.getTime();

                    // Vender 구분
                    background = "https://callback.yourdomain.com/images/subtitle_background_"+ item.origin +".png";

                    // 포맷팅
                    item.message = item.message.replace(/,/ig, ' ');    // CSV 형식에 저해되지 않게 치환

                    // 비속어 필터링
                    item.message = contentsFilter.slangFilter(item.message, '');

                    // 영상 자막
                    subtitle += `${background},${item.userImage},${item.userName},${item.message}`;

                    // 현재 자막 display 형식에 맞게 구분자 추가
                    // 쉼표 구분 2건 1줄\n
                    // 쉼표 구분 2건 1줄\n...
                    if (i % 2 == 1) {
                        subtitle += `\n`;
                    } else {
                        subtitle += `,`;
                    }

                    subtitles.push(subtitle);

                    item = null;
                    publishedTimestamp = "";
                    subtitle = "";
                }

                subtitles.reverse();    // 시간순으로
                subtitles = subtitles.join('');
                res.send(subtitles);
            }
            else {
                res.send(json);
            }
        })
        .catch((error) => {
            console.error(error);
            res.send('');
        })
});

/**
 * Youtube
 */
app.get('/youtube', (req, res) => {
	res.send('MG API callback for Youtube.');
});

/**
 * Youtube 의견들
 */
app.get('/youtube/comments', (req, res) => {
	const youtubeComments = require('./controllers/youtubeCommentsController');

    youtubeComments.main((err, data, response, val) => {
        res.send(val);
    });
});

/**
 * Youtube 라이브 채팅 메세지 목록
 */
app.get('/youtube/livechat', (req, res) => {
    const liveChat = require('./controllers/googleLiveChat');

    liveChat.list(req.query)
        .then((response) => {
            let json = response;

            if (req.query.format == "csv") {
                let subtitles = [];
                let subtitle = "";
                let item = null;
                let publishedDate = null;
                let publishedTimestamp = "";
                let background = "";

                // 데이터 루프 최대 건수 제한
                let itemLength = (json.length > 9)? 9 : json.length;

                for (let i = 0; i < itemLength; i++) {
                    item = json[i];

                    publishedDate = new Date(item.publishedAt);
                    publishedTimestamp = publishedDate.getTime();

                    // Vender 구분
                    background = "https://callback.yourdomain.com/images/subtitle_background_"+ item.origin +".png";

                    // 포맷팅
                    item.message = item.message.replace(/,/ig, ' ');    // CSV 형식에 저해되지 않게 치환

                    // 비속어 필터링
                    item.message = contentsFilter.slangFilter(item.message, '');

                    subtitle += `${background},${item.userImage},${item.userName},${item.message}`;

                    if (i % 2 == 1) {
                        subtitle += `\n`;
                    } else {
                        subtitle += `,`;
                    }

                    subtitles.push(subtitle);

                    item = null;
                    publishedTimestamp = "";
                    subtitle = "";
                }

                subtitles.reverse();    // 시간순으로
                subtitles = subtitles.join('');
                res.send(subtitles);
            } else {
                res.send(json);
            }
        })
        .catch((error) => {
            console.error(error.message);
            res.send('');
        });
});

/**
 * 아프리카TV
 */
app.get('/afreecatv', (req, res) => {
    res.send('MG API callback for Afreecatv.');
});

/**
 * 아프리카TV 채팅 메세지들
 */
app.get('/afreecatv/chat', (req, res) => {
    const afreecatvChat = require('./controllers/afreecatvChatController');

    // 채팅 목록 조회 (Consumer)
    afreecatvChat.list(req.query)
        .then((response) => {
            let data = response || [];
            res.send(data);
        })
        .catch((error) => {
            console.error(error.message);
            res.send(error);
        });
});

/**
 * 아프리카TV 채팅 메세지 프로듀서 프로세스 제어
 */
app.get('/afreecatv/chat/producer/:action', (req, res) => {
    const afreecatvChat = require('./controllers/afreecatvChatController');

    let action = req.params.action;

    if (action == 'start') {
        let bj_id = req.query.bj_id || 'yourdomain';
        let broad_no = req.query.broad_no || '';

        // 아프리카TV 채팅 메세지 수집기 데몬 작동
        // 채팅 메세지 스트림 프로듀서를 자식프로세스로 실행
        afreecatvChat.executeChildProcess(bj_id, broad_no);

        res.send('아프리카TV 채팅 메세지 스트림 프로듀서 실행중...');
    } else if (action == 'stop') {
        // 아프리카TV 채팅 메세지 수집기 데몬 종료시키기
        afreecatvChat.killChildProcess();

        res.send('아프리카TV 채팅 메세지 스트림 프로듀서 종료');
    }
});

/**
 * HTTP:3000 서비스
 */
app.listen(3000, () => {
	console.log('Callback app listening on port 3000!');
});

