/**
 * 아프리카TV 채팅 모듈
 *
 * @author cezips@gmail.com
 * @date 2016. 7. 29
 * @description
 *  Origin= http://static.m.afreecatv.com/main/js/services/chatFactory.js?v=1.3.2
 */
'use strict';

const request = require('request');
const WebSocket = require('websocket').w3cwebsocket;
const secrets = require(__base +'config/secrets.json');
const redis = require('redis').createClient();
const contentsFilter = require(__base +'helpers/contentsFilter');

const redisAfreecatvChatMessagesKey = "afreecatv_chat_messages";
const redisAfreecatvLastPollingAtKey = "afreecatv_last_polling_at";

const CHAT_INFO_URL = 'http://api.m.afreecatv.com/broad/a/watch';
const HTTPSOCKET_URL = 'http://webbridge.afreecatv.com'; //실서버
//var HTTPSOCKET_URL = 'http://118.217.182.248'; //개발서버
//var aWebSocket = ['118.217.182.249:3577', '58.229.172.130:3577', '218.38.31.147:3577', '218.38.31.148:3577'];
//var aWebSocket = ['118.217.182.248:3576'];
let aWebSocket = [];
let szLanguage = 'ko';

const STICKER_URL = 'http://cache.m.afreecatv.com/items/m_main_%d.png';
const BALLOON_URL = 'http://cache.m.afreecatv.com/items/m_balloon_%d.png';

// Redis 관련 오류 발생시
redis.on("error", (err) => {
    // Redis 서버 접속 안되면 프로세스 종료
    if (err.message.indexOf('ECONNREFUSED') != -1) {
        console.log('Redis 서버에 연결할 수 없습니다. 서버 OFF 상태 먼저 확인!');
        process.exit(0);
    } else {
        console.log(err);
    }
});

class WebChat {
    constructor() {
        this.socket = null;
        this.bConnect = false;
        this.webSocketUrl = null;
        this.nServerIndex = -1;
        this.callack = null;
        this.openCallback = null;
        this.aWebSocket = null;
    }

    /*
     * 채팅소켓 URL 생성
     * @returns {unresolved}
     */
    getSocketUrl() {
        if (this.aWebSocket.length == 0) {
            throw new Error(`Error: aWebSocket not defined`);
        }

        let szServer = '';

        if ( this.nServerIndex > 0 ) {
            //값이 있으면 순서대로 다음꺼
            this.nServerIndex++;
            if ( this.nServerIndex >= this.aWebSocket.length )
                this.nServerIndex = 0;
            szServer = this.aWebSocket[this.nServerIndex];
        } else {
            //랜덤으로 포트가져오기
            this.nServerIndex = Math.floor((Math.random() * this.aWebSocket.length));
            szServer = this.aWebSocket[this.nServerIndex];
        }

        szServer = this.aWebSocket[this.nServerIndex];

//		return 'ws://118.217.182.248:3576/Websocket';   //개발서버
        return 'ws://' + szServer + '/Websocket';
    }

    /**
     * 채팅서버 연결
     */
    connect(callback) {
        let url = this.getSocketUrl();

        this.socket = new WebSocket(url, "chat");

        this.socket.onmessage = (e) => {
            console.log("WebChat.connect() onmessage() Received: '" + e.data + "'");

            if (callback) callback(e.data);
        };

        this.socket.onopen = (e) => {
            console.log('WebChat.connect() onopen() Event: ', this.socket.readyState, e);
            this.bConnect = true;
            this.openCallback(1);
        };

        this.socket.onclose = (e) => {
            console.log('WebChat.connect() onclose() Event: ', e);
            this.bConnect = false;
        };

        this.socket.onerror = (e) => {
            console.log('WebChat.connect() onerror() Event: ', e);
            this.bConnect = false;
        };

        if (this.socket.binaryType == undefined) { //"blob" or  "arraybuffer"
            //BROWSER NOT SUPPORTED
            if (this.openCallback) this.openCallback(-1);
        }
    }


    /*
     * 채팅 종료
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    /*
     * 메시지 전송
     * @param {String} packet
     */
    send(packet) {
        try {
            this.socket.send(packet);
        } catch (error) {
            if (error.code == 11) {
                // possibly still 'CONNECTING'
                if (this.socket.readyState !== 1) {
                    console.log('retry---------------', packet);
                    // setTimeout(this.send(packet + "^"), 100);
                }
            }
        }
    }

    /*
     * 채팅소켓을 사용할수 있을때 알림 핸들러
     * @param {function} fn
     */
    openHandler(fn) {
        this.openCallback = fn
    }

    /*
     * 채팅 패킷 이벤트 핸들러
     * @param {function} fn
     */
    messageHandler(fn) {
        this.callback = fn
    }
}


class HttpChat {
    constructor() {
        this.httpChat = this;
        this.broadInfo = null;
        this.INTERVAL = 1000;
        this._httpTimer = null;
        this._call = 'local variable';
        this._timestamp = null;
        this.messageCallback = 3434;
        this._errorCount = 0;
        this._connect = false;
        this._polling = () => {
            this._connect = true;
            this._httpTimer = setTimeout(this._getChat, this.INTERVAL);
        };
    }

    _getChat() {
        if (!this.broadInfo) {
            console.error('HttpChat._getChat() this.broadInfo is null');
            return;
        }

        let aChat = this.broadInfo.channel_info.split(":");

        request(
            {
                method : 'GET',
                timeout : 1000,
                url : HTTPSOCKET_URL,
                form : {
                    cip : broadInfo.relay_ip,
                    cport : broadInfo.relay_port,
                    bno : broadInfo.broad_no,
                    chatip : aChat[0],
                    chatport : aChat[1],
                    chatroomno : broadInfo.chat_no,
                    tm : _timestamp
                }
            },
            (error, response, data) => {
                if (error || response.statusCode != 200) {
                    console.error(`HttpChat._getChat() error: ${error.message}`);

                    if (this._polling._connect) this._httpTimer = setTimeout(this._getChat, this.INTERVAL);

                    return;
                }

                console.log(`HttpChat._getChat() response data: ${data}`);

                this._errorCount = 0;
                var aMessage = data.split(String.fromCharCode(6));
                let aData = null;
                for ( var i in aMessage ) {
                    if ( aMessage[i] != '' ) {
                        aData = aMessage[i].split(String.fromCharCode(4));
                        this._timestamp = aData.shift(); //첫번째값
                        if ( aData[0] != 'START' ) {
                            //메시지 보냄
                            this.messageCallback(aData.join('|'));
                        }
                    }
                }
                if (this._polling._connect) this._httpTimer = setTimeout(this._getChat, this.INTERVAL);
            }
        );
    }

    /**
     * 채팅서버 연결
     */
    init(data) {
        this.broadInfo = data;
    }

    messageHandler(fn) {
        this.messageCallback = fn
    }

    start() {
        this._polling();
    }

    disconnect() {
        this._connect = false;
        clearTimeout(_httpTimer);
    }
}


class Chat {
    constructor() {
        this._broadInfo = null;
        this._csvWebSocketServerAddresses = null;
        this.webChat = null;
        this.httpChat = null;
        this.messageCallback = null;
        this.closeCallback = null;
        this.viewerCallback = null;
        this.clearCallback = null;
        this.alertCallback = null;
        this.pauseCallback = null;
        this.giftCallback = null;
        this.loginCallback = null;
        this.socketSupportCallback = null;
        this.blockChatClearCallback = null;
        this.szRealUserId = '';
        this.szRecommandServer = '';
        this.bPlay = false;
        this.USERLEVEL = {
            'ADMIN': 0x01            // 관리자 (강퇴, 벙어리 대상이 될 수 없음) : 운영자
            , 'HIDDEN': (0x01 << 1)     // 아이디 숨김 (사용자 목록에서 볼 수 없음) : 서버에서만 사용. 비트가 세팅되어 있으면  클라이언트에는 아예 보내지 않음.
            , 'BJ': (0x01 << 2)     // BJ : 방장
            , 'DUMB': (0x01 << 3)     // 벙어리 (채팅금지) : 벙어리 지정된 놈.
            , 'GUEST': (0x01 << 4)     // 비회원 : 아이디 없는 놈. 서버에서만 사용하고 클라이언트에는 아예 안보냄.
            , 'FANCLUB': (0x01 << 5)     // 팬클럽 회원
            , 'AUTOMANAGER': (0x01 << 6)     // 자동 메니저로 지정된 놈
            , 'MANAGERLIST': (0X01 << 7)     // 자동 매니저 리스트에 등록된놈
            , 'SUBBJ': (0x01 << 8)     // 부방장 : 매니저
            , 'FEMALE': (0x01 << 9)     // 여자 (아니면 모두 남자로 처리)
            , 'AUTODUMB': (0x01 << 10)    // 자동 벙어리 (서버에서 지정) : 서버에서 일정량 이상의 채팅 내용이 오면 벙어리로 지정한다. 클라이언트에서는 신경 안써도 됨.
            , 'DUMB_BLIND': (0x01 << 11)    // 벙어리로 인한 블라인드 : 벙어리로 인해 블라인드 지정된 놈.
            , 'DOBAE_BLIND': (0x01 << 12)    // 도배로 인한 블라인드 처리 : 도배로 인한 블라인드 지정된 놈.
            , 'EXITUSER': (0x01 << 13)    // 나간사람. 서버엔 영향 없기 때문에 클라이언트 정의 : 무시해도 됨.
            , 'MOBILE': (0x01 << 14)    // 모바일 user
            , 'TOPFAN': (0x01 << 15)    // 열혈팬 여부
            , 'REALNAME': (0x01 << 16)    // 실명인증여부 : 실명 인증되어 있는 놈이면 로그인 할 때 플래그를 세팅해서 보내야 한다.
            , 'NODIRECT': (0x01 << 17)    // 1:1 직접 채팅 금지 : 귓말 금지
            , 'GLOBAL_APP': (0x01 << 18)	// 글로벌 모바일앱 유저
            , 'QUICKVIEW': (0x01 << 19)	// 퀵뷰 사용 여부
            , 'SPTR_STICKER': (0x01 << 20)	// 스티커 서포터 여부
            , 'CHROMECAST': (0x01 << 21)	// 크롬캐스트 유저
        };

        this.$scope = null;

        /*
          creatChat() 에서 WebChat.connect() 에 의해 WebChat class 내에서 openHandler() 가 실행되는데
          this 가 Chat class 로 인식되지 않고 Webchat 으로 인식되게 되어
          openHandler() 내의 this.login() 이 undefined 오류가 발생하여
          this 의 scope 보존을 위해 아래의 꼼수 사용
        */
        this.openHandler = this.openHandler.bind(this);
        this.chatHandler = this.chatHandler.bind(this);
    }

    setScope(scope) {
        this.$scope = scope;
    }

    getBroad() {
        return this._broadInfo;
    }

    /**
     * 채팅 Initialize
     *
     * @param data 방송정보 fetch from `http://api.m.afreecatv.com/broad/a/watch?bj_id=${bj_id}&broad_no=${broad_no}&language=ko&agent=web`
     * @description
     *  http://static.m.afreecatv.com/main/js/controllers/live.player.chat.js?v=1.3.2 에서 Chat.init() 호출함
     */
    init(broadInfo, csvWebSocketServerAddresses) {
        //채팅중이고  채팅정보(중계방>본방) 가 변경되었을 경우
        if (this.bPlay && this._broadInfo != broadInfo) {
            //채팅 다시연결
            this.close();
        }

        this._broadInfo = broadInfo;
        console.log(`Chat.init() Broad Info: ${JSON.stringify(this._broadInfo)}`);

        this._csvWebSocketServerAddresses = csvWebSocketServerAddresses;

        this.creatChat();    //소켓 연결
    }

    /**
     * 채팅 생성
     *
     * @description
     *  아프리카TV 채팅 웹소켓 접속
     */
    creatChat() {
        //
    }

    /**
     * 연결이벤트
     * @param boolean connect  연결설정
     */
    openHandler(connect) {
        if (this.clearCallback) this.clearCallback();

        //채팅사용가능
        if (connect > 0) {
            //채팅 로그인
            this.login();
        } else {
            //this.noticMessage('접속하신 브라우저에서는 채팅이 지원되지 않습니다.');
            //this.noticMessage('Chrome을 이용하시면 채팅을 확인하실 수 있습니다.');
            //this.noticMessage('[작업관리자] 로 이동하여 [기본정보 지우기]를 선택하고 사용 중이신 브라우저를 삭제하시면 이후 Chrome을 기본 브라우저로 설정하실 수 있습니다.');
            this.httpChat = new HttpChat();
            this.httpChat.init(this._broadInfo);
            this.httpChat.messageHandler(this.chatHandler);
            this.httpChat.start();
            // this.illegalMessage('따뜻한 소통과 배려로 더욱 즐거운 아프리카TV를 만들어주세요!  특정인에 대한 비방과 비하, 인종/지역/성/장애인 차별, 청소년 보호법 위반, 정치 선동성 채팅은 제재의 대상이 됩니다.');
            // this.infoMessage('[안내]', '방송에 입장하셨습니다.');
            if (this.socketSupportCallback) this.socketSupportCallback(true);
        }
    }

    blockChatClearHandler( fn ) {
        this.blockChatClearCallback = fn;
    }
    loginHandler( fn ) {
        this.loginCallback = fn;
    }
    /**
     * 채팅 메시지 받을 콜백함수
     * @param {Functioin} fn
     */
    messageHandler( fn ) {
        this.messageCallback = fn;
    }
    closeHandler( fn ) {
        this.closeCallback = fn;
    }
    viewerHandler( fn ) {
        this.viewerCallback = fn;
    }
    clearHandler( fn ) {
        this.clearCallback = fn;
    }
    alertHandler( fn ) {
        this.alertCallback = fn;
    }
    pauseHandler( fn ) {
        this.pauseCallback = fn;
    }
    giftHandler( fn ) {
        this.giftCallback = fn;
    }
    socketNotSupportHandler( fn ) {
        this.socketSupportCallback = fn;
    }

    /**
     * 레벨값비교
     * @param {integer} level
     * @param {bit} chkFlag
     * @returns {Boolean}
     */
    compareFlag( level, chkFlag ) {
        return ((level & chkFlag) > 0) ? true : false;
    }
    /*
     * User 레베에 따른 클래스값
     * @param {integer} level
     * @returns {String}
     */
    getLevelClass( level, type ) {
        let szClass = '';

        if ( this.compareFlag(level, this.USERLEVEL.ADMIN) ) {	//1 : 관리자 메세지, COP
            szClass = 'st2';
            if ( type == '1' )
                szClass = 'snt st3';
            else if ( type == '2' )
                szClass = 'snt st2';

        } else if ( this.compareFlag(level, this.USERLEVEL.BJ) ) {	//2: 방송중인 BJ
            szClass = 'st4';
        } else if ( this.compareFlag(level, this.USERLEVEL.AUTOMANAGER) ) {	//6 :매니저
            szClass = 'st5';
        } else if ( this.compareFlag(level, this.USERLEVEL.MANAGERLIST) ) {	//7: 매니저
            szClass = 'st5';
        } else if ( this.compareFlag(level, this.USERLEVEL.SUBBJ) ) {	//8: 매니저
            szClass = 'st5';
        } else if ( this.compareFlag(level, this.USERLEVEL.TOPFAN) ) {	//15:열혈팬
            szClass = 'st6';
        } else if ( this.compareFlag(level, this.USERLEVEL.FANCLUB) ) {	//4: 팬클럽
            szClass = 'st7';
        } else {	//일반유저
            szClass = '';
        }

        return szClass;
    }

    /**
     * 채팅안보기/해제 레이어 노출 체크
     * @param {integer} level
     * @returns integer
     */
    checkChatHideLayer(level) {
        if ( this.compareFlag(level, this.USERLEVEL.ADMIN) ) {	//1 : 관리자 메세지, COP
            return false;
        } else if ( this.compareFlag(level, this.USERLEVEL.BJ) ) {	//2: 방송중인 BJ
            return false;
        }

        return true;
    };

    /*
     * 안내 메시지
     * @param {String} title
     * @param {String} message
     */
    infoMessage(title, message) {
        this.messageCallback({
            class: 'st1',
            nickname: title,
            'message': message,
        });
    }

    illegalMessage(message) {
        this.messageCallback({
            class: 'illegal',
            nickname: "[아프리카TV 안내]",
            'message': message
        });
    }

    /*
     * 어드민 공지 메시지
     * @param {String} message  메시지
     */
    adminNoticMessage( message ) {
        this.messageCallback({
            class: 'snt',
            nickname: '[아프리카TV 안내]',
            'message': message,
        });
    }

    /*
     * 공지 메시지
     * @param {String} message  메시지
     */
    noticMessage(message) {
        this.messageCallback({
            class: 'ntc st1',
            nickname: '',
            'message': message,
        });
    }

    close() {
        this.bPlay = false;
        this._broadInfo = null;
        if (this.webChat) {
            this.webChat.disconnect();
            this.webChat = null;
        }
        if (this.httpChat) {
            this.httpChat.disconnect();
            this.httpChat = null;
        }
    }

    play() {
        //채팅연결
        if (!this.webChat) {
            this.bPlay = true;
            this.creatChat();
        }
    }

    stop() {
        this.close();
    }

    /*
     * 로그인
     */
    login() {
        if (this._broadInfo == undefined) {
            throw new Error('this._broadInfo is undefined');
            return;
        }

        // 0:국내사용자, 1:중국사용자
        let nLanguageType = 0; //원본코드: (szLanguage == 'zh') ? 1 : 0;
        let os = 'mweb_aos'; //원본코드: Util.getOS() == 'ios' ? 'mweb_ios' : 'mweb_aos';
        let loginCommand = `LOGIN${this._broadInfo.channel_info}::${nLanguageType}:${os}`;
        console.log(`WebSocket login: ${loginCommand}`);
        this.webChat.send(loginCommand);
    }

    /*
     * 팬티켓전달
     */
    join() {
        this.webChat.send(`JOIN${this._broadInfo.chat_no}:${this._broadInfo.fan_ticket}`);
    }

    /*
     * 센터서버 연결
     */
    connectCenter() {
        this.webChat.send(`CONNECTCENTER${this._broadInfo.relay_ip}:${this._broadInfo.relay_port}:this._broadInfo.broad_no`);
    }

    /*
     * 추천서버 요청
     */
    connectRecommandServer() {
        this.webChat.send('GETITEMADDR');
    }

    /*
     * 팬티켓전달
     */
    sendMessage( message ) {
        console.log("sendMessage=", message);
        this.webChat.send(`CHAT${message}`);
    }

    /**
     * 블라인드 해제
     */
    disableBlind() {
        this.webChat.send('DUMBEND');
    }

    getAdminTitle(type) {
        let admin = '운영자';

        switch (type) {
            case 1:
                admin = 'BJ';
                break;
            case 2:
                admin = '매니저';
                break;
            case 3:
                admin = '운영자';
                break;
            case 4:     //임직원
                admin = '운영자';
                break;
            case 5:     //클린아티
                admin = '클린아티';
                break;
        }

        return admin;
    }

    getRecommandServer() {
        return this.szRecommandServer.split(':');
    }

    /*
     * 채팅 패킷처리
     * @param {String} packet
     */
    chatHandler( packet ) {
        console.log('receive < ', packet);

        let freezeStatus = false;
        let nickname = '';
        let message = '';
        let aMsg = packet.split('|');
        let adminTitle = '';

        switch ( aMsg[0].toString() ) {
            case "LOGIN":                // 1:   로그인
                this.join();
                this.szRealUserId = aMsg[1];
                this.loginCallback(this.szRealUserId);
                break;
            case "JOIN":                 // 2:   채널참여
                this.illegalMessage('따뜻한 소통과 배려로 더욱 즐거운 아프리카TV를 만들어주세요!  특정인에 대한 비방과 비하, 인종/지역/성/장애인 차별, 청소년 보호법 위반, 정치 선동성 채팅은 제재의 대상이 됩니다. ');
                this.infoMessage('[안내]', '방송에 입장하셨습니다.');
                this.connectCenter();
                this.connectRecommandServer();
                break;
            case "ALERTMSG":			// 수동 메시지
                //aMsg[1]
                break;
            case "GETITEMADDR":			// 수동 메시지
                this.szRecommandServer = aMsg[1];
                break;
            case "QUITCH":               // 3:   채널퇴장
                /*
                 0. QUITCH
                 1. QUITCHREP_QUITSTAT,    // 이값을검사해서퇴장사유를알수있다.
                 2. QUITCHREP_REQID,       // 강퇴인경우나가도록명령한아이디
                 3. QUITCHREP_KICKTYPE,    // 강퇴타입, 1:BJ에의해, 2:매니저, 3:어드민, 4:임직원, 5:클린아티
                 4. QUITCHREP_REQREASON,   // 강퇴사유(미사용)
                 */
                //방송 종료로 간주
                this.noticMessage('채널 퇴장하셨습니다.');
                this.close();

                //alert
                adminTitle = this.getAdminTitle(Number(aMsg[3]));
                alert(`${adminTitle}에 의해 강제퇴장 되었습니다.`);
                //메인으로 이동
                if ( this.alertCallback )
                    this.alertCallback(18);
                break;
            case "CHATMESG":             // 5:   채팅메시지
                let message = aMsg[1].replace(/\r/gi, '');

                if ( this.compareFlag(aMsg[5], this.USERLEVEL.ADMIN) ) {
                    aMsg[4] = "운영자 안내:";
                }

                this.messageCallback({
                    class : this.getLevelClass(aMsg[5], aMsg[6]),
                    chat_id : aMsg[2],
                    nickname : aMsg[4],
                    'message' : message,
                    possible_hide : this.checkChatHideLayer(aMsg[5])
                });
                break;
            case "SENDADMINNOTICE":             // 서버 공지사항
                this.adminNoticMessage(aMsg[1], true);
                break;
            case "SETCHNAME":           // 6:   채널이름세팅
                break;
            case "SETBJSTAT":           // 7:   방장상태변경
                switch ( Number(aMsg[1]) ) {
                    case 0: //방송종료
                        alert('BJ가 방송을 종료하였습니다.');
                        this.close();
                        if ( this.closeCallback )
                            this.closeCallback();
                        break;
                }
                break;
            case "CLOSECH":
                /*
                 0 CLOSECH
                 1 방송번호
                 2 종료타입
                 3 종료인사말
                 */
                this.noticMessage(aMsg[3]);
                break;
            case "SETDUMB":              // 8:   벙어리지정
                /*
                 * SETDUMB|lomi525(2)|1130504|0|30|1|lomi525|매그니토2|1|
                 0.SETDUMB
                 1.lomi525(2)    //벙어리 지정된 아이디
                 2.1130504       // 플래그
                 3.0             // 플래그
                 4.30            // 벙어리 유지 시간(초)
                 5.1             // 벙어리 지정 횟수
                 6.lomi525       // 벙어리 요청한 아이디
                 7.매그니토2     // 벙어리 지정된 닉네임
                 8.1             // 채팅금지타입, 1:BJ에의해, 2:매니저, 3:어드민, 4:임직원, 5:클린아티
                 */
                ///> 지정된 시간 이후 벙어리 해지 패킷 보냄
                ///> 벙어리 타켓이 나 일 경우
                adminTitle = this.getAdminTitle(Number(aMsg[8]));

                switch ( Number(aMsg[5]) ) {
                    case 1:
                        this.infoMessage('[안내]', Util.printf('%s님은 %s에 의해 채팅금지 %s회가 되셨습니다.', aMsg[7], adminTitle, aMsg[5]));
                        if ( this.szRealUserId == aMsg[1] )
                        {
                            alert(Util.printf('%s님은 %s에 의해 채팅금지 되었습니다. 30초 동안 채팅이 금지 됩니다.', aMsg[7], adminTitle));
                        }
                        break;
                    case 2:
                        this.infoMessage('[안내]', Util.printf('%s님이 %s에 의해 채팅금지 %s회가 되셨습니다.', aMsg[7], adminTitle, aMsg[5]));
                        if ( this.szRealUserId == aMsg[1] )
                        {
                            alert(Util.printf('%s님은 %s에 의해 채팅금지 되었습니다. 60초 동안 채팅이 금지 됩니다.', aMsg[7], adminTitle));
                        }
                        break;
                    case 3:
                    default:
                        this.infoMessage('[안내]', Util.printf('%s님은 %s에 의해 채팅금지 횟수 초과로 인해 2분간 블라인드 처리되었습니다.', aMsg[7], adminTitle));
                        if ( this.szRealUserId == aMsg[1] ) {
                            alert(Util.printf('%s님은 %s에 의해 채팅금지 횟수 초과로 인해 2분간 블라인드 처리됩니다. 블라인드 상태에서는 화면과 채팅이 보이지 않으며 블라인드 상태로 방송에서 나갈 경우 자동 강제퇴장 처리되며 방송 재입장이 불가능 합니다.', aMsg[7], adminTitle));
                            //화면 막음
                            this.alertCallback(20);
                        }
                        break;
                }
                break;
            case 'BLINDEXIT':
                //BLINDEXIT|lomi525(2)|실론티옹8|
                /*
                 0 BLINDEXIT|
                 1 lomi525(2)|		// 벙어리 지정된 아이디
                 2 실론티옹8||			// 플래그
                 */
                this.infoMessage('[안내]', Util.printf('%s(%s) 님이 블라인드 상태에서 탈출을 시도하여 강제퇴장 처리되었습니다.', aMsg[2], aMsg[1]));
                if ( this.blockChatClearCallback )
                    this.blockChatClearCallback(aMsg[1]);
                break;

            case "KICK":				// 11:  강퇴
                this.infoMessage('[안내]', Util.printf('%s(%s)님이 강제퇴장 처리되었습니다.', aMsg[2], aMsg[1]));
                if ( this.blockChatClearCallback )
                    this.blockChatClearCallback(aMsg[1]);
                //강제 퇴장처리
                if ( this.szRealUserId == aMsg[1] ) {
                    if ( this.alertCallback )
                        this.alertCallback(18);
                }
                break;
            case "KICKCANCEL":			//강퇴취소
                this.infoMessage('[안내]', Util.printf('%s(%s)님이 강제퇴장 취소 처리되었습니다.', aMsg[2], aMsg[1]));
                break;
            case "SENDHOPEBALLOON":			// 18:  희망풍선선물     // 비데몬에서직접접속한다.
                /*
                 * SENDHOPEBALLOON|1266|exress|큐큐오세|lomi525(2)|실론티옹8|1|
                 0: SENDBALLOON
                 1: BJ_NO,                      // 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 2: BJ_ID,                      // 보내는놈
                 3: BJ_NICK ,                 // 보낸놈 닉네임
                 4: SEND_ID,                  //보낸놈 ID
                 5: SEND_NICK,                  // 보낸놈 닉네임
                 6: COUNT,                  // 갯수
                 */
                this.giftCallback('hopeballoon', aMsg[5], aMsg[6]);
                this.noticMessage(Util.printf('%s님이 희망풍선 %s개를 선물했습니다!', aMsg[5], aMsg[6]));
                break;
            case "SENDHOPEBALLOONSUB":     // 33:  희망풍선선물(중계방)
                /*
                 0. SENDBALLOONSUB
                 1. SENDBALLOONSUBREP_CHNO,			// 채팅방 번호 (본방은 본방 채팅방 번호, 중계방은 중계방 채팅방 번호)
                 2. SENDBALLOONSUBREP_BJ,			// 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 3. SENDBALLOONSUBREP_BJNICK,		// BJ닉네임
                 4. SENDBALLOONSUBREP_VIEWER,		// 보내는놈
                 5. SENDBALLOONSUBREP_VIEWERNICK,	// 보낸놈 닉네임
                 6. SENDBALLOONSUBREP_CNT,			// 별풍선 갯수
                 7. SENDBALLOONSUBREP_FAN_SEQ,		// 팬클럽 가입 순서 (0: already fan, n: fan seqence)
                 8. SENDBALLOONSUBREP_FAN_CHIEF,	// 팬클럽 회장 선정 유무 (0: not cheif, 1: become cheif)
                 9. SENDBALLOONSUBREP_COLS
                 */
                this.giftCallback('희망풍선선물', aMsg[5], aMsg[6]);
                this.noticMessage(Util.printf('%s님이 중계방 희망풍선%s개를 선물했습니다!', aMsg[5], aMsg[6]));

                break;
            case "SENDBALLOON":			// 18:  별풍선선물     // 비데몬에서직접접속한다.
                /*
                 0: SENDBALLOON
                 1: SENDBALLOONREP_BJ,			// 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 2: SENDBALLOONREP_VIEWER,		// 보내는놈
                 3: SENDBALLOONREP_VIEWERNICK,	// 보낸놈 닉네임
                 4: SENDBALLOONREP_CNT,			// 별풍선 갯수
                 5: SENDBALLOONREP_FAN_SEQ,		// 팬클럽 가입 순서 (0: already fan, n: fan sequence)
                 6: SENDBALLOONREP_FAN_CHIEF,	// 팬클럽 회장 선정 유무 (0: not cheif, 1: become cheif)
                 7: SENDBALLOONREP_CHNO,			// 채팅방 번호
                 */
                this.giftCallback('starballoon', aMsg[3], aMsg[8]);
                //this.noticMessage(Util.printf('%s님이 별풍선 %s개를 선물했습니다!', aMsg[3], aMsg[4]));
                if ( Number(aMsg[5]) > 0 ) {
                    this.noticMessage(Util.printf('%s님이 %s번째로 팬클럽이 되셨습니다.', aMsg[3], aMsg[5]));
                }
                break;
            case "SENDBALLOONSUB":     // 33:  별풍선선물(중계방)
                /*
                 0. SENDBALLOONSUB
                 1. SENDBALLOONSUBREP_CHNO,			// 채팅방 번호 (본방은 본방 채팅방 번호, 중계방은 중계방 채팅방 번호)
                 2. SENDBALLOONSUBREP_BJ,			// 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 3. SENDBALLOONSUBREP_BJNICK,		// BJ닉네임
                 4. SENDBALLOONSUBREP_VIEWER,		// 보내는놈
                 5. SENDBALLOONSUBREP_VIEWERNICK,	// 보낸놈 닉네임
                 6. SENDBALLOONSUBREP_CNT,			// 별풍선 갯수
                 7. SENDBALLOONSUBREP_FAN_SEQ,		// 팬클럽 가입 순서 (0: already fan, n: fan seqence)
                 8. SENDBALLOONSUBREP_FAN_CHIEF,	// 팬클럽 회장 선정 유무 (0: not cheif, 1: become cheif)
                 9. SENDBALLOONSUBREP_COLS
                 */
                this.giftCallback('starballoon', aMsg[5], aMsg[8]);
                //this.noticMessage(Util.printf('%s님이 중계방 별풍선%s개를 선물했습니다!', aMsg[5], aMsg[6]));
                if ( Number(aMsg[7]) > 0 ) {
                    this.noticMessage(Util.printf('%s님이 %s번째로 팬클럽이 되셨습니다.', aMsg[5], aMsg[7]));
                }

                break;
            case "ICEMODE":						// 19:  채팅얼리기(채팅금지)
                /*
                 0 ICEMODE
                 1 ICEMODEREP_ON,				//	1: 채팅창 얼리기, 0: 풀기
                 2 ICEMODEREP_ICEMODETYPE,		//	0: 풀기,
                 1: 얼리기(BJ,매니저 채팅가능)
                 2: 얼리기(BJ,매니저, 팬클럽)
                 3: 얼리기(BJ,매니저, 서포터)
                 4: 얼리기(BJ,매니저, 팬클럽, 서포터)
                 */
                ///> 얼리기
                if ( Number(aMsg[1]) === 1 ) {
                    let szMsg = '';

                    if ( freezeStatus === false ) {
                        szMsg = '채팅창을 얼렸습니다.';
                    } else {
                        szMsg = '채팅 참여 등급이 변경되었습니다.';
                    }

                    freezeStatus = aMsg[2];
                    switch ( Number(aMsg[2]) ) {
                        case 1:
                            this.infoMessage('[안내]', szMsg + 'BJ와 매니저만 채팅에 참여할 수 있습니다.');
                            break;
                        case 2:
                            this.infoMessage('[안내]', szMsg + 'BJ와 매니저, 팬클럽만 채팅에 참여할 수 있습니다.');
                            break;
                        case 3:
                            this.infoMessage('[안내]', szMsg + ' BJ와 매니저, 서포터만 채팅에 참여할 수 있습니다.');
                            break;
                        case 4:
                            this.infoMessage('[안내]', szMsg + ' BJ와 매니저, 팬클럽, 서포터만 채팅에 참여할 수 있습니다.');
                            break;
                    }
                } else {
                    freezeStatus = false;
                    this.infoMessage('[안내]', '채팅창을 녹였습니다. 채팅에 참여할 수 있습니다.');
                }
                break;
            case "SENDFANLETTER":      // 20:  팬레터보내기
                /*
                 * ["SENDFANLETTER", "oky0707", "oky0707", "lomi525", "실론티옹8", "", "235", "", "1", "0", "229", ""]
                 0: SENDFANLETTER |
                 1: SENDFANLETTERREP_BJID,         // BJ아이디 (뒤에 아이디 순번까지 보내야 함)
                 2: SENDFANLETTERREP_BJNICK,       // BJ닉네임
                 3: SENDFANLETTERREP_SENDERID,     // 보내는 놈 아이디
                 4: SENDFANLETTERREP_SENDERNICK,   // 보내는 놈 닉네임
                 5: SENDFANLETTERREP_IMAGEURL,     // 이미지 URL
                 6: SENDFANLETTERREP_PAPER,        // 편지지 종류
                 7: SENDFANLETTERREP_MESSAGE,      // 내용
                 8: SENDFANLETTERREP_ITEMCOUNT,    // 펜레터 카운트
                 9: SENDFANLETTERREP_SPTR_SEQ,		// 스티커 서포터 가입 순서 (0: already supporter, n: supporter sequence)
                 10: SENDFANLETTERREP_CHNO,			// 채팅방 번호
                 */
                this.giftCallback('sticker', aMsg[4], aMsg[8], aMsg[6]);
                this.noticMessage(Util.printf('%s님이 스티커 %s개를 선물했습니다!', aMsg[4], aMsg[8]));
                if ( Number(aMsg[9]) > 0 ) {
                    this.noticMessage(Util.printf('%s님이 %s번째로 서포터가 되셨습니다.', aMsg[4], aMsg[9]));
                }
                break;
            case "SENDFANLETTERSUB":   // 34:  스티커선물(중계방)
                /*
                 0: SENDFANLETTERSUB |
                 1 SENDFANLETTERSUBREP_CHNO,         // 채팅방 번호 (본방은 본방 채팅방 번호, 중계방은 중계방 채팅방 번호)
                 2 SENDFANLETTERSUBREP_BJID,         // BJ아이디 (뒤에 아이디 순번까지 보내야 함)
                 3 SENDFANLETTERSUBREP_BJNICK,       // BJ닉네임
                 4 SENDFANLETTERSUBREP_SENDERID,     // 보내는 놈 아이디
                 5 SENDFANLETTERSUBREP_SENDERNICK,   // 보내는 놈 닉네임
                 6 SENDFANLETTERSUBREP_IMAGEURL,     // 이미지 URL
                 7 SENDFANLETTERSUBREP_PAPER,        // 편지지 종류
                 8 SENDFANLETTERSUBREP_MESSAGE,      // 내용
                 9 SENDFANLETTERSUBREP_ITEMCOUNT,    // 펜레터 카운트
                 10 SENDFANLETTERSUBREP_SPTR_SEQ,	  // 스티커 서포터 가입 순서 (0: already supporter, n: supporter squence)
                 11 SENDFANLETTERSUBREP_COLS
                 SENDFANLETTERSUB|1076|sksk230|환이,|mobqq05|기개가그가||248||1|0|
                 */
                this.giftCallback('sticker', aMsg[4], aMsg[8], aMsg[7]);
                this.noticMessage(Util.printf('%s님이 중계방 스티커 %s개를 선물했습니다!', aMsg[5], aMsg[9]));
                if ( Number(aMsg[10]) > 0 ) {
                    this.noticMessage(Util.printf('%s님이 %s번째로 서포터가 되셨습니다.', aMsg[5], aMsg[10]));
                }
                break;
            case "CHOCOLATE":          // 37:  초콜릿선물(데몬)
                /*
                 0: CHOCOLATE
                 1: SENDCHOCOLATEREQ_CHNO,		// 채팅방 번호
                 2: SENDCHOCOLATEREQ_BJ,			// 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 3: SENDCHOCOLATEREQ_VIEWER,		// 보내는놈
                 4: SENDCHOCOLATEREQ_VIEWERNICK,	// 보내는놈 닉네임
                 5: SENDCHOCOLATEREQ_CNT			// 초콜릿 갯수
                 */
                this.giftCallback('chocolate', aMsg[4], aMsg[5]);
                this.noticMessage(`${aMsg[4]}님이 초콜릿 ${aMsg[5]}개를 선물했습니다!`);
                break;
            case "CHOCOLATESUB":        // 38:  초콜릿선물(데몬 :중계방)
                /*
                 0. CHOCOLATESUB
                 1. SENDCHOCOLATESUBREP_CHNO,		// 채팅방 번호 (본방은 본방 채팅방 번호, 중계방은 중계방 채팅방 번호)
                 2. SENDCHOCOLATESUBREP_BJ,			// 받는놈 (뒤에 아이디 순번까지 보내야 함)
                 3. SENDCHOCOLATESUBREP_VIEWER,		// 보내는놈
                 4. SENDCHOCOLATESUBREP_VIEWERNICK,	// 보낸놈 닉네임
                 5. SENDCHOCOLATESUBREP_CNT,		// 초콜릿 갯수
                 6. SENDCHOCOLATESUBREP_COLS
                 */
                this.giftCallback('chocolate', aMsg[4], aMsg[5]);
                this.noticMessage(`${aMsg[4]}님이 중계방 초콜릿 ${aMsg[5]}개를 선물했습니다!`);
                break;
            case "SENDQUICKVIEW":      // 45:  퀵뷰선물
                /*
                 0: SENDQUICKVIEW
                 1: SENDQUICKVIEWREP_CHNO,				// 채팅방 번호
                 2: SENDQUICKVIEWREP_SENDER,			// 보내는 사람ID
                 3: SENDQUICKVIEWREP_SENDERNICK,		// 보내는 사람NICK
                 4: SENDQUICKVIEWREP_ID,				// 받는 사람ID
                 5: SENDQUICKVIEWREP_NICK,				// 받는 사람NICK
                 6: SENDQUICKVIEWREP_ITEMTYPE,			// 아이템 타입(1: 30일권, 2:90일권, 3:365일권)
                 7: SENDQUICKVIEWREP_ITEMCODE,			// 아이템 코드(퀵뷰 사용시 필요한 코드)
                 */
                switch (Number(aMsg[6])) {
                    case 1:
                        this.szType = 30;
                        break;
                    case 2:
                        this.szType = 90;
                        break;
                    case 3:
                        this.szType = 365;
                        break;
                }
                this.noticMessage(`${aMsg[3]} 님이 ${aMsg[5]}님에게 퀵뷰 ${this.szType}일권을 선물했습니다!`);
                break;
            case "SETCHINFO":
                //채널정보
                if ( Number(aMsg[1]) === 19 ) {
                    this.close();
                    if ( this.alertCallback )
                        this.alertCallback(19);
                }
                break;
            case "GETUSERCNT":			// device 정보 넘길 시점
                /*
                 0
                 1,		// 채팅방 번호
                 2,		// PC
                 3,		// 모바일
                 4,     // 중계방합계
                 */
                if ( this.viewerCallback )
                    this.viewerCallback(Number(aMsg[2]) + Number(aMsg[3]));
                ///> device 정보를 넘긴다.
                //console.log("CHROMEUV" + BROAD_INFO.szDeviceId);
                break;
            case "CHATERROR":			// device 정보 넘길 시점
                ///> device 정보를 넘긴다.
                this.noticMessage(aMsg[3]);
                if (aMsg[1] == 2) {
                    if (this.clearCallback)
                        this.clearCallback();
                    if (this.alertCallback)
                        this.alertCallback(21);
                }
                break;
            case "GETCHINFO":			// device 정보 넘길 시점
                ///> device 정보를 넘긴다.
                //console.log("CHROMEUV" + BROAD_INFO.szDeviceId);
                break;
            case "MOBBROADPAUSE":			//방송 일시정지기능
                this.pauseCallback(aMsg[1] == '0' ? true : false);
                break;
            case "DIRECTCHAT":			// 9:   직접대화(1:1)
            case "NOTICE":				// 10:  공지(전체) 메시지 :관리자만가능
            case "SETSUBBJ":			// 13:  부방장지정
            case "SETNICKNAME":			// 14:  닉네임변경
            case "CLUBCOLOR":			// 17:  팬클럽글자색지정
            case "BLINDKICK":          // 25:  블라인드퇴장시강퇴
            case "MANAGERCHAT":        // 26:  메니저채팅
            case "APPENDDATA":         // 27:  강퇴누적패널티
            case "SNSMESSAGE":         // 31:  SNS 메세지(소셜스트림)
            case "SNSMODE":             // 32:  SNS 메세지(소셜스트림) ON = 1/ OFF = 0
            case "BJSTICKERITEM":      // 36:  BJ 스티커아이템설정 :알림
            case "TOPCLAN":            // 39:  열혈클랜원(데몬)
            case "TOPCLANSUB":         // 40:  열혈클랜원(데몬 :중계방)
            case "SUPERCHAT":          // 41:  슈퍼채팅(데몬)
            case "UPDATETICKET":       // 42:    티켓갱신(팬티켓복호화한뒤유저플래그갱신)
            case "NOTIGAMERANKER":     // 43:  게임신 :TOP20 입장시채널로알려줌
            case "STARCOIN":           // 44: 스타코인(글로벌별풍선)
            case "ITEMSTATUS":         // 46:  아이템사용여부확인
            case "ITEMUSING":          // 47:  아이템사용
            case "USEQUICKVIEW":       // 48:  퀵뷰선물권사용
            case "ICEMODERELAY":       // 49:  채팅얼리기(채팅금지 :중계방)
            case "NOTIFYPOLL":          // 50:  투표상태변경알림
            case "CHATBLOCKMODE":      // 51:    채팅차단모드설정(설정된유저는SVC_CHATMESG를받지않음)
                break;
            default:
                break;
        }
    }
}


class Util {
    static printf(str, ...args) {
        return `${str}`;
    }
}


/**
 * 아프리카TV 채팅 조작 클래스
 */
class AfreecatvChat extends Chat
{
    constructor() {
        super();

        this.connectInterval = null;
        this.BROAD_INFO = {};
        this.childProcess = null;
    }

    /**
     * @Override
     * 채팅 생성
     *
     * @description
     *  아프리카TV 채팅 웹소켓 접속
     */
    creatChat() {
        let isConnectedChattingRoom = false;
        let queueLengthLimit = 20;

        let webChat = new WebChat();
        webChat.aWebSocket = this._csvWebSocketServerAddresses;
        let url = webChat.getSocketUrl();

        let webSocket = new WebSocket(url, "chat");

        webSocket.onopen = (e) => {
            console.log('WebChat.connect() onopen() Event: ', webSocket.readyState, e);

            // 아직 채팅서버에 로그인하지 않았다면
            if (!this.bConnect) {
                // 1. 채팅서버에 로그인
                webSocket.send(`LOGIN${this._broadInfo.channel_info}::0:mweb_aos`);
                this.bConnect = true;
            }
        };

        webSocket.onclose = (e) => {
            console.log('WebChat.connect() onclose() Event: ', e);
            isConnectedChattingRoom = false;
            this.bConnect = false;
            this.killChildProcess();
        };

        webSocket.onerror = (e) => {
            console.log('WebChat.connect() onerror() Event: ', e);
            isConnectedChattingRoom = false;
            this.bConnect = false;
        };

        webSocket.onmessage = (e) => {
            let data = e.data;

            // 2. 채팅서버에 로그인이 성공했다면
            if (/^LOGIN\|/.test(data)) {
                // 3. 채팅방에 들어가기
                webSocket.send(`JOIN${this._broadInfo.chat_no}:${this._broadInfo.fan_ticket}`);
            }

            // 4. 채팅방에 들어가기가 성공했다면
            if (/^JOIN\|/.test(data)) {
                // 5. 채팅 센터 접속
                webSocket.send(`CONNECTCENTER${this._broadInfo.relay_ip}:${this._broadInfo.relay_port}:${this._broadInfo.broad_no}`);
                webSocket.send(`GETITEMADDR`);
            }

            // 6. 채팅 센터 접속이 성공했다면
            if (/^CONNECTCENTER\|/.test(data)) {
                isConnectedChattingRoom = true;
            }

            // 7. 채팅방 메세지가 수신되는 상태
            if (isConnectedChattingRoom) {
                // 8. 사용자 채팅 메세지만 필터링
                if (/^CHATMESG\|/.test(data)) {
                    data += Date.now();
                    console.log(`Chat message: ${data}`);

                    /*
                     * redis 큐에 timestamp 와 함께 채팅 메세지 저장
                     * 채팅메세지 샘플:
                     CHATMESG|쭌님리~|livais|7078125|한또니♥대부|1672032|0|
                     CHATMESG|헐 아직두?|cool6516|7078125|폐지줍는쭌|538525728|0|
                     CHATMESG|이쁘셔라 😘|abwlrtmxhfl|0|참다운신뢰란|536952832|0|
                     */
                    // 메세지 큐 저장 데이터 수가 제한을 넘지 않도록
                    // http://www.redisgate.com/redis/command/ltrim.php
                    redis.ltrim(redisAfreecatvChatMessagesKey, 0, (queueLengthLimit - 1), (error, response) => {
                        // 메세지 큐 왼쪽에 데이터 추가
                        redis.lpush(redisAfreecatvChatMessagesKey, data, (error, response) => {
                            /* 메세지 큐 오른쪽에서 데이터 꺼내기
                             redis.rpop(redisAfreecatvChatMessagesKey, (error, response) => {
                             console.log(`Redis poped: ${response}`);
                             });*/
                        });
                    });
                }

                // 9. BJ가 방송을 종료시
                if (/^CLOSECH\|/.test(data)) {
                    this.killChildProcess()
                        .then((code) => {
                            console.log('BJ가 방송을 종료하였습니다.');
                        });
                }
            }
        };
    }

    connect(bj_id = '', broad_no = '') {
        // 방송정보 조회
        this.getBroadcastInfo(bj_id, broad_no)
            .then((response) => {
                if (!response) {
                    return;
                }

                let json = response;

                if (json.result < 0) {
                    // 방송 상태가 아닌경우 접속 될때까지 재귀호출로 접속 시도
                    if (json.data.code == -3001 || json.data.message.indexOf('종료된 방송')) {
                        console.log(json.data.message, '접속 될때까지 접속 시도!');
                        if (this.connectInterval == null) {
                            let connectIntervalSec = 60 * 5;   // 5분
                            this.connectInterval = setInterval(() => {
                                this.connect(bj_id, broad_no)
                            }, 1000 * connectIntervalSec);
                        }
                        return;
                    }

                    console.error(json.data.message);
                    return json.data.message;
                }

                // 접속 될때까지 접속 시도 끝내기
                if (this.connectInterval != null) {
                    clearInterval(this.connectInterval);
                }

                // 응답을 방송정보 변수에 할당
                broad_no = json.data.broad_no;
                this.BROAD_INFO = json.data;

                // 소켓서버 리스트 조회하고 채팅서버 소켓 접속
                this.getWebSockets()
                    .then((response) => {
                        if (!response) {
                            console.error('AfreecatvChat.connect() -> getBroadcastInfo() -> getWebSockets() Error: no response');
                            return [];
                        }

                        // 응답을 콘솔에 출력
                        console.log(`AfreecatvChat.connect() -> getBroadcastInfo() -> getWebSockets() response: ${response}`);

                        let csvWebSocketServerAddresses = response;

                        this.init(this.BROAD_INFO, csvWebSocketServerAddresses);
                    });
            }
        );
    }

    /**
     * 채팅 리스트 조회
     *
     * @description
     *  Redis 에 쌓아둔 채팅 리스트를 조회하여 반환
     *  creatChat() 에서 웹소켓 접속 후 메세지들을 Redis 에 쌓음
     */
    list(queryString) {
        return new Promise((resolve, reject) => {
            let data = [];

            // 메세지 큐 전체 데이터 조회
            redis.lrange(redisAfreecatvChatMessagesKey, 0, -1, (error, response) => {
                if (error) return reject(error.message);

                if (!response || response.length == 0) {
                    console.log('Redis queue empty');
                    return resolve(data);
                }

                console.log(`Redis list range: ${response}`);
                let json = this.convertPayloadToJson(response) || [];

                if (json.length == 0) resolve(json);

                // 가장 마지막 조회했던 시간 값 로딩
                redis.get(redisAfreecatvLastPollingAtKey, (err, reply) => {
                    let lastPollingAt = (reply)? reply.toString() : "";

                    // 목록 강제 조회시, 큐 항목들 전체 조회
                    if (queryString.force == 'yes') {
                        //json.reverse();    // 리스팅 순서 시간순으로
                        resolve(json);
                    }
                    // 목록 일반 조회시, 읽었던 큐 항목 Skip
                    else {
                        // 가장 마지막 item 날짜를 polling 했던 날짜 캐시에 저장
                        redis.set(redisAfreecatvLastPollingAtKey, json[0].publishedAt);

                        // 최근 Polling 시간과 비교해서 기존에 가져왔던 데이터 이후 시간 데이터만 필터링
                        data = json.filter((item) => {
                            if (item.publishedAt > lastPollingAt) return item;
                        });

                        resolve(data.reverse());    // 리스팅 순서 시간순으로
                    }
                });
            });
        });
    }

    /**
     * 채팅 리스트를 CSV로 변환
     *
     * @returns {string}
     */
    convertListToCSV(data) {
        let items = [];
        let item = null;
        let csv = "";
        let background = "https://callback.yourdomain.com/images/subtitle_background_afreecatv.png";

        for(let i = 0; i < data.length; i++) {
            if (!data[i]) continue;

            item = data[i];

            // Vender 구분
            //background = "https://callback.yourdomain.com/images/subtitle_background_afreecatv.png";

            // 포맷팅
            item.userName = item.userName.replace(/,/ig, ' ');  // CSV 형식에 저해되지 않게 치환
            item.message = item.message.replace(/,/ig, ' ');    // CSV 형식에 저해되지 않게 치환

            // 비속어 필터링
            item.message = contentsFilter.slangFilter(item.message, '');

            csv += `${background},${item.userImage},${item.userName},${item.message}`;

            if (i % 2 == 1) {
                csv += `\n`;
            } else {
                csv += `,`;
            }

            items.push(csv);

            item = null;
            csv = '';
        }

        items.reverse();    // 시간순으로

        return items.join('');
    }

    /**
     * 원본 채팅 메세지들을 JSON 으로 변환
     *
     * payload 사례: 'CHATMESG|리신이트린한테카정을|alswp154123|0|이쁜이유소나|536953376|0|1469964516134'
     */
    convertPayloadToJson(payload) {
        if (!payload) return '';

        let itemRaws = null;
        let items = [];
        let item = null;
        let CommentModel = require(__base +'models/comment');

        for(let i = 0; i < payload.length; i++) {
            if (!payload[i]) continue;

            itemRaws = payload[i].split('|');  // 원본 메세지를 구분자로 나누기

            // 모델 인스턴스
            item = new CommentModel();

            // 각 데이터들을 모델에 우겨넣고
            item.id = itemRaws[5];
            item.origin = 'afreecatv';
            item.kind = 'chat';
            item.userImage = `https://callback.yourdomain.com/images/user_anonymous_afreecatv.png?userId=${itemRaws[2]}`;
            item.userName = itemRaws[4];
            item.messageOriginal = itemRaws[1];
            item.message = item.messageOriginal;
            item.publishedAt = itemRaws[7];

            // 포맷팅
            item.message = item.message.replace(/<[^>]+>/ig, '');

            // 배열에 쌓기
            items.push(item);
            item = null;
        }

        return items;
    }

    /**
     * 방송 정보 조회
     *
     * @param bj_id  BJ아이디  필수
     * @param broad_no  방송번호  지정하지 않으면 가장 최신 방송번호가 조회됨
     * @param password  방송암호  암호가 지정된 방송일경우 필수
     */
    getBroadcastInfo(bj_id = '', broad_no = '', password = '') {
        return new Promise((resolve, reject) => {
            let formData = {
                bj_id: bj_id,
                broad_no: broad_no,
                language: 'ko',
                agent: 'web',
                password: password,
            };

            request.post(
                {
                    url: 'http://api.m.afreecatv.com/broad/a/watch',
                    form: formData,
                    json: true
                },
                (error, response, data) => {
                    if (error || response.statusCode != 200) {
                        console.error(error.message);
                        //reject(error.message);
                        return;
                    }

                    resolve(data);
                }
            );
        });
    }

    /**
     * 웹소켓(채팅) 서버 목록 조회
     */
    getWebSockets() {
        return new Promise((resolve, reject) => {
            let requestOptions = {
                url: 'http://api.m.afreecatv.com/broad/chat/bridge/a/getList',
                headers: {
                    'Content-Type' : 'application/x-www-form-urlencoded'
                },
                json: true,
                timeout : 1000
            };

            request(requestOptions, (error, response, data) => {
                if (error || response.statusCode != 200) {
                    console.error(error.message);
                    reject(error.message);
                    return;
                }

                let nResult = data.result;
                switch (nResult) {
                    case 1 :
                        resolve(data.data.list);
                        break;
                    default:
                }
            });
        });
    }

    /**
     * 채팅 메세지 스트림 프로듀서를 자식프로세스로 실행
     *
     * @param bj_id
     * @param broad_no
     */
    executeChildProcess(bj_id = '', broad_no = '') {
        if (this.childProcess) this.killChildProcess();

        // 아프리카TV 웹소켓 접속 데몬 커맨드라인 명령으로 실행
        const spawn = require('child_process').spawn;
        this.childProcess = spawn('node', [__base +'bin/afreecatvChat.js', bj_id, broad_no]);

        // 프로세스 데이터 발생시
        this.childProcess.stdout.on('data', (data) => {
            console.log(`AfreecaTV Chat Producer process stdout:`, data.toString());
        });
        // 프로세스 오류 발생시
        this.childProcess.stderr.on('data', (data) => {
            console.log(`AfreecaTV Chat Producer process stderr:`, data.toString());
        });
        // 프로세스 stdio 스트림이 닫혔을때
        this.childProcess.on('close', (code) => {
            console.log(`AfreecaTV Chat Producer process closed with code ${code}`);
        });
        // 프로세스 종료시
        this.childProcess.on('exit', (code) => {
            if (code) this.killChildProcess();
            console.log(`AfreecaTV Chat Producer process exited with code ${code}`);
        });
    }

    /**
     * 채팅 메세지 스트림 프로듀서 강제 종료
     *
     * @description
     *  this.executeChildProcess() 에서 자식프로세스로 실행했던 pid 로 프로세스 강제 종료
     */
    killChildProcess() {
        return new Promise((resolve, reject) => {
            // 프로세스를 죽이고
            this.childProcess.kill('SIGHUP');
            this.childProcess = null;

            // Promise.then()에 정상종료 반환
            resolve(1);
        });
    }
}


module.exports = new AfreecatvChat();