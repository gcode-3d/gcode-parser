import sqlite, { Database } from "sqlite3"
sqlite.verbose()

const saltRounds = 10
import bcrypt from "bcrypt"
import crypto from "crypto"
import UserTokenResult from "./classes/UserTokenResult.js"
import Device from "./classes/device.js"
import File from "./classes/file.js"
import LogPriority from "./enums/logPriority.js"
import Setting from "./enums/setting.js"

export default class Storage {
    private db: Database
    private settings: Map<Setting, boolean | number | string>
    constructor() {
        this.db = new sqlite.Database("storage.db", (err) => {
            if (err) {
                throw err
            }
        })
        this.db.serialize(async () => {
            this.db.run(
                "CREATE TABLE IF NOT EXISTS users (username varchar(30) primary key,password char(40) not null, permissions integer(8) not null default '0')"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS  tokens (username varchar(30) not null,token varchar(50) not null primary key,expire datetime, foreign key (username) REFERENCES users(username))"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS devices (name varchar(255) PRIMARY KEY, path varchar(255) not null, width integer(4) not null, depth integer(4) not null, height integer(4) not null, baud varchar(10) not null default 'Auto', heatedBed boolean not null, heatedChamber boolean not null)"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS files (name varchar(255) PRIMARY KEY, data BLOB not null, uploaded datetime )"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS logs (date datetime not null, shortDescription varchar(255) not null, priority integer(3) not null, details TEXT not null )"
            )

            this.db.run(
                "CREATE TABLE IF NOT EXISTS settings (selectedDevice varchar(255), BstartOnBoot boolean default 0 not null)"
            )

            await this.fetchSettings()
            return
        })
    }

    private fetchSettings(): Promise<Map<Setting, boolean | number | string>> {
        return new Promise((resolve, reject) => {
            this.db.get("select * from settings", (error: Error, row: any) => {
                if (error) {
                    return this.log(
                        LogPriority.Error,
                        "SETTINGS_FETCH",
                        error.message
                    )
                        .then(() => {
                            return reject(error)
                        })
                        .catch(reject)
                }
                if (!row) {
                    this.db.run(
                        "insert into settings (selectedDevice, BstartOnBoot) values (null, false)"
                    )
                    return this.fetchSettings().then(resolve).catch(reject)
                } else {
                    this.settings = new Map()
                    Object.entries(row).forEach((entry: any) => {
                        if (entry[0].startsWith("B")) {
                            this.settings.set(entry[0], entry[1] == 1)
                        } else {
                            this.settings.set(entry[0], entry[1])
                        }
                    })
                    return resolve(this.settings)
                }
            })
        })
    }

    async getSettings() {
        if (!this.settings) {
            await this.fetchSettings()
        }
        return this.settings
    }

    setSetting(key: Setting, value: string | number | boolean): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (!this.settings) {
                await this.fetchSettings()
            }
            let statement = this.db.prepare(
                "update settings set " + key + " = ?"
            )
            statement.run([value], async (result: any, error: Error) => {
                if (error) {
                    this.log(LogPriority.Error, "SETTINGS_FETCH", error.message)
                        .then(() => reject(error))
                        .catch(reject)
                }
                this.settings.set(key, value)
                resolve()
            })
        })
    }

    needsSetup(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.get(
                "select count(*) as count from users",
                (err: Error, row: any) => {
                    if (err) {
                        return reject(err)
                    }

                    return resolve(row.count === 0)
                }
            )
        })
    }

    saveUser(username: string, password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            bcrypt
                .hash(password, saltRounds)
                .then((passwordHash) => {
                    var statement = this.db.prepare(
                        "insert into users (username, password, permissions) values (?, ?, 1)"
                    )
                    statement.run([username, passwordHash], (err) => {
                        if (err) {
                            return reject(err)
                        }
                        return resolve()
                    })
                })
                .catch((e) => {
                    console.error(e)
                    return reject(e)
                })
        })
    }

    validateUser(username: string, password: string) {
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

    listDeviceConfigNames(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            var statement = this.db.prepare("select name from devices")
            statement.all((err: Error, rows: string[]) => {
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
                            row.heatedBed,
                            row.heatedChamber,
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
                "insert into devices (name, width, depth, height, path, baud, heatedBed, heatedChamber) values (?, ?, ?, ?, ?, ?, ?, ?)",
                device.name,
                device.width,
                device.depth,
                device.height,
                device.path,
                device.baud,
                device.heatedBed,
                device.heatedChamber
            )
            statement.run((err: Error, r: any) => {
                if (err) {
                    return reject(err)
                }
                return resolve()
            })
        })
    }

    getDeviceByName(name: string): Promise<Device> {
        return new Promise((resolve, reject) => {
            this.db.get(
                "select * from devices where name = ?",
                [name],
                (error: Error, row: any) => {
                    if (error) {
                        return reject(error)
                    }
                    if (!row) {
                        return resolve(null)
                    } else {
                        return resolve(
                            new Device(
                                row.name,
                                row.path,
                                row.width,
                                row.depth,
                                row.height,
                                row.heatedBed,
                                row.heatedChamber,
                                row.baud
                            )
                        )
                    }
                }
            )
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
            this.db.run(
                "insert into files (name, data, uploaded) values (?, ?, datetime('now'))",
                [name, data],
                (err: Error, result: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve()
                }
            )
        })
    }

    checkFileExistsByName(name: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            this.db.get(
                "select 1 from files where name = ? limit 1",
                name,
                (err: Error, row: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(row !== undefined)
                }
            )
        })
    }

    getFileList(): Promise<File[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                "select name, uploaded from files",
                (err: Error, rows: any) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(
                        rows.map((row: any) => ({
                            name: row.name,
                            uploaded: new Date(row.uploaded),
                        }))
                    )
                }
            )
        })
    }

    getFileByName(name: string): Promise<File> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            this.db.get(
                "select name, data, uploaded from files where name = ?",
                [name],
                (err: Error, row: any) => {
                    if (err) {
                        return reject(err)
                    } else if (!row) {
                        return resolve(null)
                    }
                    return resolve(
                        new File(row.name, new Date(row.uploaded), row.data)
                    )
                }
            )
        })
    }

    updateFileName(old_name: string, new_name: string): Promise<null> {
        return new Promise((resolve, reject) => {
            if (!old_name || old_name.length == 0) {
                return reject("No old name specified")
            } else if (!new_name || new_name.length == 0) {
                return reject("No new name specified")
            }
            this.db.run(
                "update files set name = ? where name = ?",
                [new_name, old_name],
                (err: Error, result: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(null)
                }
            )
        })
    }

    removeFileByName(name: string): Promise<null> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            this.db.run(
                "delete from files where name = ?",
                [name],
                (err: Error, result: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(null)
                }
            )
        })
    }

    log(
        priority: LogPriority,
        shortDescription: String,
        details: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (
                shortDescription.length <= 0 ||
                shortDescription.length >= 255
            ) {
                return reject(
                    "Short description is too " +
                        (shortDescription.length <= 0 ? "short" : "long")
                )
            }
            this.db.run(
                "insert into logs (date,priority, shortDescription, details) values (datetime('now'), ?, ?, ?)",
                [priority, shortDescription, details],
                (err: Error, result: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve()
                }
            )
        })
    }
}
