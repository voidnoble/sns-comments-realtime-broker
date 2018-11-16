/**
 * 개발 웹푸시 RabbitMQ 큐 소비 (콘솔용)
 * @author cezips@gmail.com
 * @date 2016-09-01
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
        new winston.transports.File({ filename: '/var/log/webpush/access_dev.log' })
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: '/var/log/webpush/error_dev.log' })
    ]
});

// 글로벌 루트경로 확인하여 할당
global.__base = __dirname +'/../';

// MQ 서비스 큐 라우팅 키
const queueRoutingKey = 'test-queue';

// 웹푸시 GCM API 키 셋팅
webPush.setGCMAPIKey('AIzaSyBfevRM4PoY_3iLxpl1tOxjiaIZvSTIbEU');


// 커뮤니티 개발 DB HOST: x.x.x.x
const dbConn = mysql.createConnection({
    host: 'community.yourdomain.com',
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
            if (payload.recipient_member_srl && payload.tag != 'debug') {
                sql += ' And member_srl = ?';
                sqlPrepares = [payload.recipient_member_srl];
                sql = mysql.format(sql, sqlPrepares);
            }

            //sql += ' Limit 20'; // for DEV
            // console.log(sql); return; // for DEV

            dbConn.query(sql, (err, rows) => {
                if (err) {
                    console.error(err.message);
                    //throw err;
                }

                if (typeof rows == 'undefined') return;
                if (rows.length < 0) return;

                let promises = rows.map((row, i) => {
                    return new Promise((resolve, reject) => {
                        //console.log('yield = '+ row.registration_id);

                        let endpoint = "https://android.googleapis.com/gcm/send/" + row.registration_id;
                        let webPushOptions = null;

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

                        if (payload.tag == 'debug') {
                            logger.log('info', payload.tag, row);
                            reject(false);
                        }

                        webPush.sendNotification(endpoint, webPushOptions)
                            .then((res) => {
                                logger.log('info', 'Push Notification successfully sent', row);
                                console.log('Push Notification successfully sent', res);

                                resolve(true);
                            })
                            .catch((err) => {
                                // 인증되지 않은 등록이라는 오류가 포함된 응답시
                                if (err.body.indexOf('UnauthorizedRegistration') !== -1) {
                                    // 구독상태를 No 로 업데이트
                                    dbConn.query("UPDATE ?? SET ?? = ? WHERE ?? = ?", ['xe_push_subscription', 'subscription_status', 'N', 'id', row.id], (error, result) => {
                                        if (error) {
                                            logger.log('error', error);
                                        }

                                        if (result.affectedRows) {
                                            logger.log('info', `Unsubscribed database row id = ${row.id}`);
                                        }
                                    });

                                    /*// DB 에서 이 row 제거
                                     dbConn.query("DELETE FROM ?? WHERE ?? = ?", ['xe_push_subscription', 'id', row.id], (error, result) => {
                                         if (error) {
                                            logger.log('error', error);
                                         }

                                         if (result.affectedRows) {
                                            logger.log('info', `Deleted database row id = ${row.id}`);
                                         }
                                     });*/
                                }

                                logger.log('error',
                                    {
                                        endpoint: endpoint,
                                        message: err.message,
                                        headers: err.headers,
                                        body: err.body
                                    }
                                );

                                console.log(
                                    `ERROR in sending Notification, maybe endpoint "${endpoint}" was removed\n`,
                                    err.message + '\n',
                                    //err.headers +'\n',
                                    err.body    // html type google error message
                                );

                                reject(false);
                            });
                    });
                });

                Promise.all(promises)
                    .then((results) => {
                        console.log(results);
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            });
        });
    });
});