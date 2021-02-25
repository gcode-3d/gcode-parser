"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const permissions_js_1 = __importDefault(require("./permissions.js"));
class UserTokenResult {
    constructor(username, expire, permissions) {
        this.username = username;
        this.expire = new Date(expire);
        this.permissions = new permissions_js_1.default(permissions);
    }
}
exports.default = UserTokenResult;
