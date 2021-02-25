import Permissions from "./permissions.js"

export default class UserTokenResult {
    username: string
    expire: Date
    permissions: Permissions
    constructor(username: string, expire: number, permissions: number) {
        this.username = username
        this.expire = new Date(expire)
        this.permissions = new Permissions(permissions)
    }
}
