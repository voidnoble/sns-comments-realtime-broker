/**
 * 웹푸시 RabbitMQ 큐 소비 (콘솔용)
 * @author cezips@gmail.com
 * @date 2016-08-30
 * @description
 *  https://www.npmjs.com/package/mysql
 *  https://www.npmjs.com/package/amqp
 *  https://github.com/web-push-libs/web-push
 *  https://www.npmjs.com/package/logzio-nodejs
 */
'use strict';

const mysql = require('mysql');
const amqp = require('amqp');
const webPush = require('web-push');
const winston = require('winston'); // 로그 기록 모듈
//const logger = require('logzio-nodejs').createLogger({ token: '' }); // Logz.io 로그 기록 모듈
// 로그 기록기 설정
const logger = new (winston.Logger)({
    transports: [
        new winston.transports.File({ filename: '/var/log/webpush/notification.log' })
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: '/var/log/webpush/error.log' })
    ]
});

// 글로벌 루트경로 확인하여 할당
global.__base = __dirname +'/../';

// MQ 서비스 큐 라우팅 키
const queueRoutingKey = 'community_webpush';
//const queueRoutingKey = 'test-queue'; // 개발시 사용

// 웹푸시 GCM API 키 셋팅
webPush.setGCMAPIKey('AIzaSyBfevRM4PoY_3iLxpl1tOxjiaIZvSTIbEU');


// DB HOST: 218.153.6.120 (192.168.2.103)
const dbConn = mysql.createConnection({
    host: '192.168.2.103',
    user: 'xe',
    password: 'xe1devel',
    database: 'xe'
});

dbConn.connect((err) => {
    if (err) {
        console.error('error db connecting: '+ err.stack);
        return;
    }

    console.log('db connected as id '+ dbConn.threadId);
});

dbConn.query('SELECT 1', (err, rows) => {
    if (err) throw err;

    console.log('db connected!');
});

// RabbitMQ Host
const mqConn = amqp.createConnection({
    host: '192.168.2.102',
    login: 'web_push_service',
    password: '',
    vhost: 'web-push',
    ssl: {
        enabled: false
    }
});

mqConn.on('error', (err) => {
    console.error('Error from amqp: ', err);
});

// Wait for connection to become established.
mqConn.on('ready', () => {
    console.log('MQ Consumer is ready');
    // Use the default 'amq.topic' exchange
    mqConn.queue(queueRoutingKey, { autoDelete: false }, (queue) => {
        // Catch all messages
        // https://www.npmjs.com/package/amqp#queuebindexchange-routing-callback
        queue.bind('#');

        // Receive messages
        queue.subscribe((message) => {
            console.log("Received message");
            // Print messages to stdout
            //console.log(message.data.toString(), JSON.parse(message.data));

            /*
            payload: {
                "title": "알림 제목",
                "message": "알림 메세지",
                "url": "알림 클릭시 이동시킬 URL",
                "tag": "알림 구분자",
                "recipient_member_srl": "수신자 커뮤니티 회원번호",
            }
            */
            let payload = JSON.parse(message.data);

            // 필수 값 체크...
            if (typeof payload == 'undefined') {
                return '{ "success": false, "message": "payload required" }';
            }

            logger.log('info', 'dump payload', payload);

            // 구독자 전체 목록 조회
            let sql = "SELECT ?? FROM ?? WHERE ?? = ?";
            let columns = ['id','registration_id','public_key','auth_token'];
            let sqlPrepares = [columns, 'xe_push_subscription', 'subscription_status', 'Y'];
            sql = mysql.format(sql, sqlPrepares);

            // 수신자가 정해져 있다면
            if (payload.recipient_member_srl) {
                sql += ' And member_srl = ?';
                sqlPrepares = [payload.recipient_member_srl];
                sql = mysql.format(sql, sqlPrepares);
            }

            //console.log(sql); // for DEV

            dbConn.query(sql, (err, rows) => {
                if (err) {
                    console.error(err.message);
                    //throw err;
                }

                if (typeof rows == 'undefined') return;
                if (rows.length < 0) return;

                // Generator 선언
                let itemsGenerator = function* (items) {
                    if (items.length < 0) return;

                    for (let i = 0, itemsCount = items.length; i < itemsCount; i++) {
                        yield items[i];
                    }
                };

                let endpoint = "",
                    webPushOptions = null;

                for (let row of itemsGenerator(rows)) {    // Generator 사용
                    //console.log('yield = '+ row.registration_id);

                    endpoint = "https://android.googleapis.com/gcm/send/"+ row.registration_id;

                    if (payload && row.public_key && row.auth_token) {
                        webPushOptions = {
                            payload: JSON.stringify(payload),
                            userPublicKey: row.public_key,
                            userAuth: row.auth_token,
                            TTL: 3600 * 2
                        };
                    } else {
                        webPushOptions = {
                            TTL: 3600 * 2
                        };
                    }

                    logger.log('info', 'Send Web Push Notification', row);

                    webPush.sendNotification(endpoint, webPushOptions)
                        .then((res) => {
                            logger.log('info', 'Push Notification sent to registration_id = '+ row.registration_id);
                            console.log(res);
                        })
                        .catch((err) => {
                            // 인증되지 않은 등록이라는 오류가 포함된 응답시
                            if (err.body.indexOf('UnauthorizedRegistration') !== -1) {
                                /*// 구독상태를 No 로 업데이트
                                dbConn.query("UPDATE ?? SET ?? = ? WHERE ?? = ?", ['xe_push_subscription', 'subscription_status', 'N', 'id', row.id], (error, result) => {
                                    if (error) {
                                        logger.log('error', error);
                                    }

                                    if (result.changedRows) {
                                        logger.log('info', `Unsubscribed row id = ${row.id}`);
                                    }
                                });*/

                                /*// DB 에서 이 row 제거
                                dbConn.query("DELETE FROM ?? WHERE ?? = ?", ['xe_push_subscription', 'id', row.id], (error, result) => {
                                    if (error) {
                                        // IIFE for sync process
                                        (() => {
                                            logger.log('error', error);
                                        })();
                                    }

                                    if (result.affectedRows) {
                                        // IIFE for sync process
                                        (() => {
                                            logger.log('info', `Deleted database row id = ${row.id}`);
                                        })();
                                    }
                                });*/
                            }

                            logger.log('error', {
                                message: err.message,
                                headers: err.headers,
                                body: err.body
                            });

                            console.log(
                                err.message + '\n',
                                //err.headers +'\n',
                                err.body    // html type google error message
                            );
                        });
                }
            });
        });
    });
});
