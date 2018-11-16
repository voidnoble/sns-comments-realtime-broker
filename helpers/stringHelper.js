/**
 * String 도우미 함수들
 *
 * Usage:
 *
 * require('./helpers/stringHelper');
 *
 * let str = "bla bla bla";
 *
 * console.log( str.byteCut(10) );
 */

/**
 * 문자열의 바이트 길이 구하기
 */
if (!String.prototype.byteLength) {
    (function() {
        'use strict'; // needed to support `apply`/`call` with `undefined`/`null`

        String.prototype.byteLength = function() {
            let str = this;
            let length = 0;

            if (!str) return length;

            for(let i = 0; i < str.length; i++) {
                if(escape(str.charAt(i)).length >= 4)
                    length += 2;
                else if(escape(str.charAt(i)) == "%A7")
                    length += 2;
                else
                    if(escape(str.charAt(i)) != "%0D") length++;
            }

            return length;
        };
    }());
}

/**
 * 문자열을 한글 1자를 2Byte 인식하여 자름
 * 파라미터 길이 넘으면 말줄임표 붙여 반환
 */
if (!String.prototype.byteCut) {
    (function() {
        'use strict'; // needed to support `apply`/`call` with `undefined`/`null`

        String.prototype.byteCut = function(len) {
            let str = String(this);

            if (!str) return '';

            let suffix = '';
            let strByteLength = str.byteLength();

            if (strByteLength <= len) return str;

            len -= (strByteLength % 2 == 0)? 3 : 4;   // for suffix '...'
            suffix = '...';

            let count = 0,
                cutPos = 0;

            for (let i = 0, strLength = str.length; i < strLength; i++) {
                if (escape(str.charAt(i)).length >= 4) {
                    count += 2;
                } else {
                    if (escape(str.charAt(i)) != "%0D") count++;
                }

                if (count > len) {
                    if (escape(str.charAt(i)) == "%0A") i--;
                    cutPos = i;
                    break;
                }
            }

            return str.substring(0, cutPos) + suffix;
        };
    }());
}
