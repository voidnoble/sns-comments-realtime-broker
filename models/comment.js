/**
 * Created by yjkwak on 2016. 7. 15..
 */
'use strict';

class CommentModel {
    constructor() {
        // 인스턴스 변수 선언 및 초기화
        this.id = '';
        this.origin = '';
        this.kind = '';
        this.userName = '';
        this.userImage = '';
        this.message = '';
        this.messageOriginal = '';
        this.publishedAt = '';
        this.updatedAt = '';
    }

    /* getter/setter 쓸거면 인스턴스 변수명들 prefix 로 _ 추가
    get id() {
        return this._id;
    }
    set id(value) {
        this._id = value;
    }

    get origin() {
        return this._origin;
    }
    set origin(value) {
        this._origin = value;
    }

    get kind() {
        return this._kind;
    }
    set kind(value) {
        this._kind = value;
    }

    get userName() {
        return this._userName;
    }
    set userName(value) {
        this._userName = value;
    }

    get userImage() {
        return this._userImage;
    }
    set userImage(value) {
        this._userImage = value;
    }

    get message() {
        return this._message;
    }
    set message(value) {
        this._message = value;
    }

    get messageOriginal() {
        return this._messageOriginal;
    }
    set messageOriginal(value) {
        this._messageOriginal = value;
    }

    get publishedAt() {
        return this._publishedAt;
    }
    set publishedAt(value) {
        this._publishedAt = value;
    }

    get updatedAt() {
        return this._updatedAt;
    }
    set updatedAt(value) {
        this._updatedAt = value;
    }*/
}

module.exports = CommentModel;
