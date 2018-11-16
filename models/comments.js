/**
 * 의견들 클래스
 *
 * @author cezips@gmail.com
 * @date 2016-08-03
 */
class Comments {
    constructor(json) {
        this._json = json;
    }

    get json() {
        return this._json;
    }

    set json(json) {
        // validate json
        if (typeof json != "object") {
            console.warn("Comments class value must be an object.");
            return;
        }

        // set value to the class variable
        this._json = json;
    }

    /**
     * 시간 역순 정렬
     *
     * @returns json array
     */
    orderByPublishedAtDesc() {
        let timeStamp1, timeStamp2;

        return this.json.sort((me1, me2) => {
            timeStamp1 = (isNaN(me1.publishedAt))? new Date(me1.publishedAt).getTime() : me1.publishedAt;
            timeStamp2 = (isNaN(me2.publishedAt))? new Date(me2.publishedAt).getTime() : me2.publishedAt;

            return timeStamp2 - timeStamp1;
        });
    }

    /**
     * 시간 순 정렬
     *
     * @returns json array
     */
    orderByPublishedAtAsc() {
        let timeStamp1, timeStamp2;

        return this.json.sort((me1, me2) => {
            timeStamp1 = (isNaN(me1.publishedAt))? new Date(me1.publishedAt).getTime() : me1.publishedAt;
            timeStamp2 = (isNaN(me2.publishedAt))? new Date(me2.publishedAt).getTime() : me2.publishedAt;

            return timeStamp1 - timeStamp2;
        });
    }

    /**
     * 중복되지 않는 메세지 JSON 배열 반환
     *
     * @returns json array
     */
    unique() {
        let uniques = [],
            datas = this.json,
            data = {},
            indexOf = 0;

        for (let i = 0, len = datas.length; i < len; i++) {
            data = datas[i];

            indexOf = -1;

            for (let j = 0, len = uniques.length; j < len; j++) {
                if (uniques[j].message == data.message) {
                    indexOf = 0;
                    break;
                }
            }

            if (indexOf === -1) uniques.push(data);
        }

        return uniques;
    }

    /**
     * JSON array 를 CSV 문자열로 반환
     *
     * @returns {string}
     */
    toCSV(itemsLengthLimit = 9) {
        let items = [];
        let item = null;
        let csv = "";
        let publishedDate = null;
        let publishedTimestamp = "";
        let background = "";
        let columnCount = 3;
        let messageMinLength = 4;
        let messageMaxLength = 40;
        let userNameMaxLength = 10;

        for (let i = 0, jsonLength = this.json.length; i < jsonLength; i++) {
            item = this.json[i];

            publishedDate = new Date(item.publishedAt);
            publishedTimestamp = publishedDate.getTime();

            // Vender 구분
            background = "https://callback.yourdomain.com/images/subtitle_background_"+ item.origin +".png";

            // 포맷팅
            item.userName = item.userName.replace(/[,\n]/ig, ' ');    // CSV 형식에 저해되지 않게 치환
            item.message = item.message.replace(/[,\n]/ig, ' ');    // CSV 형식에 저해되지 않게 치환
            item.userName = item.userName.replace(/\s{2,}/ig, ' ');    // 공백 2개 이상은 1개로
            item.message = item.message.replace(/\s{2,}/ig, ' ');    // 공백 2개 이상은 1개로
            item.userName = item.userName.trim();
            item.message = item.message.trim();

            // 짧은 메세지 Skip
            if (item.message.length < messageMinLength) continue;

            // 유저명 문자열 자르기
            if (item.userName.length > userNameMaxLength) {
                item.userName = item.userName.substring(0, (userNameMaxLength - 2)) + '..';
            }
            // 메세지 문자열 자르기
            if (item.message.length > messageMaxLength) {
                item.message = item.message.substring(0, (messageMaxLength - 3)) + '...';
            }

            // 영상 자막
            csv += `${background},${item.userImage},${item.userName},${item.message}`;

            items.push(csv);

            item = null;
            publishedTimestamp = "";
            csv = "";

            // 데이터 루프 최대 건수 제한
            if (items.length >= itemsLengthLimit) break;
        }

        // 시간순으로 다시 정렬
        items.reverse();

        // 현재 자막 display 형식에 맞게 구분자 추가
        // ${columnCount}건이면 1줄\n 아니면 , 구분
        let spacer = '';
        csv = '';
        items.forEach((str, i) => {
            spacer = ((i + 1) % columnCount == 0)? `\n` : `,`;
            csv += str + spacer;
        });

        // Return the csv
        return csv;
    }
}

module.exports = Comments;