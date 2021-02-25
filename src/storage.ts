import sqlite, { Database } from "sqlite3"
sqlite.verbose()

import bcrypt from "bcrypt"
import crypto from "crypto"
import UserTokenResult from "./classes/UserTokenResult.js"
import Device from "./classes/device.js"

export default class Storage {
    db: Database
    constructor() {
        this.db = new sqlite.Database("storage.db", (err) => {
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

    validateUser(username: any, password: any) {
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

    generateNewToken(username: any, noExpire: any) {
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
    validateToken(token: string): Promise<UserTokenResult | Boolean> {
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
                return resolve(
                    new UserTokenResult(
                        row.username,
                        row.expire,
                        row.permissions
                    )
                )
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
    listDevices(): Promise<Device[]> {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare("select * from devices")
            statement.all((err, rows) => {
                if (err) {
                    return reject(err)
                }
                let devices: Device[] = rows.map(
                    (row) =>
                        new Device(
                            row.name,
                            row.path,
                            row.width,
                            row.depth,
                            row.height,
                            row.baud
                        )
                )
                return resolve(devices)
            })
        })
    }

    saveDevice(device: Device): Promise<void> {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "insert into devices (name, width, depth, height, path, baud) values (?, ?, ?, ?, ?, ?)",
                device.name,
                device.width,
                device.depth,
                device.height,
                device.path,
                device.baud
            )
            statement.run((err: any, r: any) => {
                if (err) {
                    return reject(err)
                }
                console.log(r)
                return resolve()
            })
        })
    }
}
