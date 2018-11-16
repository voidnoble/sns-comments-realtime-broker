/**
 * 아프리카TV 채팅 모듈 콘솔모드 시작
 *
 * @author cezips@gmail.com
 * @date 2016-07-31
 * @description
 *  콘솔명령: node afreecatvChat.cli.js ${bj_id} ${broad_no}
 */
'use strict';

global.__base = __dirname +'/../';

let args = process.argv.slice(2);

let bj_id = args[0] || 'your-bj-id';
let broad_no = args[1] || '';

const afreecatvChat = require('./../controllers/afreecatvChatController');

afreecatvChat.connect(bj_id, broad_no);