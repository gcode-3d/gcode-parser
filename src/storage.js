const sqllite = require("sqlite3").verbose()
const bcrypt = require("bcrypt")
const crypto = require("crypto")

const Permissions = require("./permissions")

module.exports = class Storage {
    constructor() {
        this.db = new sqllite.Database("storage.db", (err) => {
            if (err) {
                throw err
            }
        })
        this.db.serialize(() => {
            this.db.run(
                "CREATE TABLE IF NOT EXISTS users (username varchar(30) primary key,password char(40) not null, permissions integer(8) not null default '0')"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS  tokens (username varchar(30) not null,token varchar(50) not null primary key,expire datetime, foreign key (username) REFERENCES users(username))"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS devices (name varchar(255) PRIMARY KEY, path varchar(255) not null, width integer(4) not null, depth integer(4) not null, height integer(4) not null, baud varchar(10) not null default 'Auto' )"
            )
        })
    }

    validateUser(username, password) {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "select password from users where username = ?",
                username
            )
            statement.get((err, row) => {
                if (err) {
                    return reject(err)
                }
                if (row == null) {
                    return resolve(false)
                }
                bcrypt
                    .compare(password, row.password)
                    .then(resolve)
                    .catch(reject)
            })
        })
    }

    generateNewToken(username, noExpire) {
        return new Promise((resolve, reject) => {
            var statement = crypto.randomBytes(25, (err, buf) => {
                if (err) {
                    return reject(err)
                }
                var token = buf.toString("hex")
                var statement = this.db.prepare(
                    "insert into tokens (username, token, expire) values (?,?,?)",
                    username,
                    token,
                    noExpire
                        ? null
                        : new Date(new Date().getTime() + 6 * 60 * 60 * 1000) // 6 hours
                )
                statement.run((err) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(token)
                })
            })
        })
    }
    validateToken(token) {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "select A.token, A.username, A.expire, B.permissions from tokens A INNER JOIN users B on A.username = B.username where token = ?",
                token
            )
            statement.get((err, row) => {
                if (err) {
                    return reject(err)
                }
                if (!row) {
                    return resolve(false)
                }
                if (row.expire) {
                    if (new Date(row.expire).getTime() < new Date().getTime()) {
                        return resolve(false)
                    }
                }
                return resolve({
                    username: row.username,
                    expire: new Date(row.expire),
                    permissions: new Permissions(row.permissions),
                })
            })
        })
    }

    listDeviceConfigNames() {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare("select name from devices")
            statement.all((err, rows) => {
                if (err) {
                    return reject(err)
                }
                return resolve(rows)
            })
        })
    }
    listDevices() {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare("select * from devices")
            statement.all((err, rows) => {
                if (err) {
                    return reject(err)
                }
                return resolve(rows)
            })
        })
    }

    saveDevice(name, width, depth, height, path, baud) {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "insert into devices (name, width, depth, height, path, baud) values (?, ?, ?, ?, ?, ?)",
                name,
                width,
                depth,
                height,
                path,
                baud
            )
            statement.run((err, r) => {
                if (err) {
                    return reject(err)
                }
                console.log(r)
                return resolve()
            })
        })
    }
}
