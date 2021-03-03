import Database, { Database as DatabaseType } from "better-sqlite3"

import bcrypt from "bcrypt"
import crypto from "crypto"
import UserTokenResult from "./classes/UserTokenResult.js"
import Device from "./classes/device.js"
import File from "./classes/file.js"

export default class Storage {
    db: DatabaseType
    constructor() {
        this.db = new Database("storage.db")
        this.setupTables([
            "CREATE TABLE IF NOT EXISTS users (username varchar(30) primary key,password char(40) not null, permissions integer(8) not null default '0')",
            "CREATE TABLE IF NOT EXISTS  tokens (username varchar(30) not null,token varchar(50) not null primary key,expire datetime, foreign key (username) REFERENCES users(username))",
            "CREATE TABLE IF NOT EXISTS devices (name varchar(255) PRIMARY KEY, path varchar(255) not null, width integer(4) not null, depth integer(4) not null, height integer(4) not null, baud varchar(10) not null default 'Auto' )",
            "CREATE TABLE IF NOT EXISTS files (name varchar(255) PRIMARY KEY, data BLOB not null, uploaded datetime )",
        ])
    }
    private setupTables(queries: string[]) {
        queries.forEach((query) => {
            let stmt = this.db.prepare(query)
            stmt.run()
        })
    }

    needsSetup(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare(
                "select count(*) as count from users"
            )
            try {
                const row = statement.get()
                return resolve(row.count === 0)
            } catch (e) {
                return reject(e)
            }
        })
    }

    validateUser(username: any, password: any) {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "select password from users where username = ?"
            )
            try {
                let row = statement.get(username)
                if (row == null) {
                    return resolve(false)
                }
                bcrypt
                    .compare(password, row.password)
                    .then(resolve)
                    .catch(reject)
            } catch (err) {
                return reject(err)
            }
        })
    }

    generateNewToken(username: any, noExpire: any): Promise<string> {
        return new Promise((resolve, reject) => {
            var statement = crypto.randomBytes(25, (err, buf) => {
                if (err) {
                    return reject(err)
                }
                var token = buf.toString("hex")
                var statement = this.db.prepare(
                    "insert into tokens (username, token, expire) values (?,?,?)"
                )
                try {
                    statement.run(
                        username,
                        token,
                        noExpire
                            ? null
                            : new Date(
                                  new Date().getTime() + 6 * 60 * 60 * 1000
                              ) // 6 hours
                    )
                    resolve(token)
                } catch (e) {
                    return reject(e)
                }
            })
        })
    }

    validateToken(token: string): Promise<UserTokenResult | Boolean> {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "select A.token, A.username, A.expire, B.permissions from tokens A INNER JOIN users B on A.username = B.username where token = ?"
            )
            try {
                let row = statement.get(token)
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
            } catch (e) {
                return reject(e)
            }
        })
    }

    listDeviceConfigNames(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare("select name from devices")
            try {
                let rows = statement.all()
                return resolve(rows)
            } catch (e) {
                reject(e)
            }
        })
    }
    listDevices(): Promise<Device[]> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare("select * from devices")
            try {
                let rows = statement.all()
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
            } catch (e) {
                return reject(e)
            }
        })
    }

    saveDevice(device: Device): Promise<void> {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare(
                "insert into devices (name, width, depth, height, path, baud) values (?, ?, ?, ?, ?, ?)"
            )
            try {
                statement.run(
                    device.name,
                    device.width,
                    device.depth,
                    device.height,
                    device.path,
                    device.baud
                )
                resolve()
            } catch (e) {
                return reject(e)
            }
        })
    }

    insertFile(name: string, data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            if (!data) {
                return reject("No data given")
            }
            let statement = this.db.prepare(
                "insert into files (name, data, uploaded) values (?, ?, datetime('now'))"
            )
            try {
                statement.run(name, data)
                return resolve()
            } catch (e) {
                return reject(e)
            }
        })
    }

    checkFileExistsByName(name: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            let statement = this.db.prepare(
                "select 1 from files where name = ? limit 1"
            )
            try {
                let row = statement.get(name)
                return resolve(row !== undefined)
            } catch (e) {
                reject(e)
            }
        })
    }

    getFileList(): Promise<File[]> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare("select name, uploaded from files")
            try {
                let rows = statement.all()
                resolve(
                    rows.map((row: any) => ({
                        name: row.name,
                        uploaded: new Date(row.uploaded),
                    }))
                )
            } catch (e) {
                reject(e)
            }
        })
    }

    getFileByName(name: string): Promise<File> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            let statement = this.db.prepare(
                "select name, data, uploaded from files where name = ?"
            )
            try {
                let row = statement.get(name)
                if (!row) {
                    return resolve(null)
                }
                return resolve(
                    new File(row.name, new Date(row.uploaded), row.data)
                )
            } catch (e) {
                return reject(e)
            }
        })
    }

    updateFileName(old_name: string, new_name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!old_name || old_name.length == 0) {
                return reject("No old name specified")
            } else if (!new_name || new_name.length == 0) {
                return reject("No new name specified")
            }
            let statement = this.db.prepare(
                "update files set name = ? where name = ?"
            )
            try {
                statement.run(new_name, old_name)
                resolve()
            } catch (e) {
                reject(e)
            }
        })
    }
    removeFileByName(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            let statement = this.db.prepare("delete from files where name = ?")
            try {
                statement.run(name)
                return resolve()
            } catch (e) {
                reject(e)
            }
        })
    }
}
