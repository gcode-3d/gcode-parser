import sqlite, { Database } from "sqlite3"
sqlite.verbose()

const saltRounds = 10
import bcrypt from "bcrypt"
import crypto from "crypto"
import UserTokenResult from "./classes/UserTokenResult.js"
import File from "./classes/file.js"
import LogPriority from "./enums/logPriority.js"
import Setting from "./enums/setting.js"
import LogEntry from "./classes/LogEntry.js"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import NotificationType from "./enums/notificationType.js"

export default class Storage {
    private db: Database
    private settings: Map<Setting, boolean | number | string>
    private readonly storageLocation = path.join(process.cwd(), "files")
    constructor() {
        this.db = new sqlite.Database("storage.db", (err) => {
            if (err) {
                throw err
            }
        })

        fs.access(
            this.storageLocation,
            fs.constants.W_OK | fs.constants.R_OK,
            (err) => {
                if (err) {
                    if (err.code == "ENOENT") {
                        return fs.mkdir(this.storageLocation, (err) => {
                            if (err) {
                                throw err
                            }
                        })
                    }
                    throw err
                }
            }
        )
        this.db.serialize(async () => {
            this.db.run(
                "CREATE TABLE IF NOT EXISTS users (username varchar(30) primary key,password char(40) not null, permissions integer(8) not null default '0')"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS  tokens (username varchar(30) not null,token varchar(50) not null primary key,expire datetime, foreign key (username) REFERENCES users(username))"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS logs (date datetime not null, shortDescription varchar(255) not null, priority integer(3) not null, details TEXT not null )"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS settings (id varchar(255) primary key, type integer(3) not null default 0, value TEXT)"
            )
            this.db.run(
                "CREATE TABLE IF NOT EXISTS notification (id varchar(36) primary key, type integer(3) not null, content TEXT not null, date DATETIME default( DATETIME('now')), dismissed Boolean not null default 0, dismissTime DATETIME )"
            )

            await this.fetchSettings()
            return
        })
    }

    private createDefaultSettings(): Promise<void> {
        function getType(char: string) {
            if (char == "B_") {
                return "boolean"
            } else if (char == "N_") {
                return "number"
            } else {
                return "string"
            }
        }
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT INTO settings (id, type, value) VALUES " +
                    Object.keys(Setting)
                        .map(() => "(?, ?, ?)")
                        .join(", "),
                Object.values(Setting)
                    .map((value) => [value, getType(value.slice(0, 2)), null])
                    .flat(1),
                (error: Error) => {
                    if (error) {
                        console.error(error)
                        return reject(error)
                    }
                    return resolve()
                }
            )
        })
    }

    private fetchSettings(): Promise<Map<Setting, boolean | number | string>> {
        return new Promise((resolve, reject) => {
            this.db.all(
                "select * from settings",
                async (error: Error, rows: any) => {
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
                    if (!rows || rows.length == 0) {
                        await this.createDefaultSettings()
                        return this.fetchSettings().then(resolve).catch(reject)
                    } else {
                        this.settings = new Map()
                        rows.forEach(
                            (row: {
                                id: Setting
                                type: string
                                value: null
                            }) => {
                                if (row.type == "boolean") {
                                    this.settings.set(row.id, row.value == "1")
                                } else if (row.type == "number") {
                                    this.settings.set(
                                        row.id,
                                        parseFloat(row.value)
                                    )
                                } else {
                                    this.settings.set(row.id, row.value)
                                }
                            }
                        )
                        return resolve(this.settings)
                    }
                }
            )
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
                "update settings set value = ? where id = ?"
            )
            statement.run([value, key], async (result: any, error: Error) => {
                if (error) {
                    this.log(LogPriority.Error, "SETTINGS_SET", error.message)
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

    saveDevice(
        width: number = 0,
        depth: number = 0,
        height: number = 0,
        path: string,
        baud: number,
        heatedBed: boolean,
        heatedChamber: boolean
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let promises = [
                this.setSetting(Setting.DeviceWidth, width),
                this.setSetting(Setting.DeviceDepth, depth),
                this.setSetting(Setting.DeviceHeight, height),
                this.setSetting(Setting.DevicePath, path),
                this.setSetting(Setting.DeviceBaud, baud),
                this.setSetting(Setting.DeviceHasHeatedBed, heatedBed),
                this.setSetting(Setting.DeviceHasHeatedChamber, heatedChamber),
            ]

            Promise.all(promises)
                .then(() => resolve())
                .catch(reject)
        })
    }

    insertFileWithStream(
        stream: Readable,
        fileBoundary: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let fsStream: fs.WriteStream
            let isCapturing: boolean = false
            stream.on("data", (data: Buffer) => {
                let chunk = data.toString("utf8")
                chunk = chunk.replace(/\r\n?|\n/g, "\n")

                if (chunk.split(/\r\n?|\n/)[0].trim() == "--" + fileBoundary) {
                    let header = chunk.split("\n\n")[0]
                    let nameResult = header.match(
                        /Content-Disposition: form-data; name="file"; filename="([^\\]*\.gcode)"/
                    )
                    if (nameResult == null) {
                        stream.destroy()
                        return reject("This file has no name specified")
                    }
                    chunk = chunk.substr(header.length).trimStart()
                    fsStream = fs.createWriteStream(
                        path.join(this.storageLocation, nameResult[1]),
                        "utf8"
                    )
                    isCapturing = true
                }

                if (
                    chunk.indexOf("--" + fileBoundary + "--") != -1 &&
                    isCapturing
                ) {
                    chunk = chunk.substr(
                        0,
                        chunk.indexOf("--" + fileBoundary + "--")
                    )
                    isCapturing = false
                }
                if (chunk.length > 0) {
                    fsStream.write(chunk)
                }
            })
            stream.on("end", () => {
                if (!fsStream) {
                    return reject("No files uploaded")
                }
                fsStream.emit("end")
                resolve()
            })
        })
    }

    checkFileExistsByName(name: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            if (!/[^\\]*\.gcode$/i.test(name)) {
                return reject(
                    "File name is not correct, it should be in this format: name.gcode . Only allowed characters are [a-zA-Z0-9_]"
                )
            }
            fs.access(
                path.join(this.storageLocation, name),
                fs.constants.W_OK | fs.constants.R_OK,
                (err) => {
                    if (err) {
                        if (err.code == "ENOENT") {
                            return resolve(false)
                        }
                        return reject(err)
                    }
                    return resolve(true)
                }
            )
        })
    }

    getFileList(): Promise<File[]> {
        return new Promise((resolve, reject) => {
            fs.readdir(this.storageLocation, (err, files) => {
                if (err) {
                    return reject(err)
                }
                files = files.filter((file) => file.endsWith(".gcode"))
                if (files.length == 0) {
                    return resolve([])
                }
                Promise.all(
                    files
                        .map(
                            (file): Promise<File> => {
                                return new Promise((resolve, reject) =>
                                    fs.stat(
                                        path.join(this.storageLocation, file),
                                        (err, result) => {
                                            if (err) {
                                                if (err.code == "EPERM") {
                                                    return resolve(null)
                                                }
                                                return reject(err)
                                            }

                                            resolve(
                                                new File(
                                                    file,
                                                    result.birthtime,
                                                    result.size,
                                                    null
                                                )
                                            )
                                        }
                                    )
                                )
                            }
                        )
                        .filter((file) => file !== null)
                )
                    .then(resolve)
                    .catch(reject)
            })
        })
    }

    getFileByName(name: string): Promise<File> {
        return new Promise(async (resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            if (!/[^\\]*\.gcode$/i.test(name)) {
                return reject(
                    "File name is not correct, it should be in this format: name.gcode . Only allowed characters are [a-zA-Z0-9_]"
                )
            }
            try {
                var fileStats: fs.Stats = await new Promise(
                    (resolve, reject) => {
                        fs.stat(
                            path.join(this.storageLocation, name),
                            (err, stats) => {
                                if (err) {
                                    return reject(err)
                                }
                                resolve(stats)
                            }
                        )
                    }
                )
            } catch (e) {
                return reject(e)
            }
            let stream = fs.createReadStream(
                path.join(this.storageLocation, name)
            )
            stream.setEncoding("utf8")
            stream.pause()
            return resolve(
                new File(name, fileStats.birthtime, fileStats.size, stream)
            )
        })
    }

    updateFileName(old_name: string, new_name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!old_name || old_name.length == 0) {
                return reject("No old name specified")
            } else if (!new_name || new_name.length == 0) {
                return reject("No new name specified")
            }
            if (!/[^\\]*\.gcode$/i.test(old_name)) {
                return reject(
                    "Old file name is not correct, it should be in this format: name.gcode . Only allowed characters are [a-zA-Z0-9_]"
                )
            } else if (!/[^\\]*\.gcode$/i.test(new_name)) {
                return reject(
                    "New file name is not correct, it should be in this format: name.gcode . Only allowed characters are [a-zA-Z0-9_]"
                )
            }
            fs.rename(
                path.join(this.storageLocation, old_name),
                path.join(this.storageLocation, new_name),
                (err) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve()
                }
            )
        })
    }

    removeFileByName(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("No name specified")
            }
            if (!/[^\\]*\.gcode$/i.test(name)) {
                return reject(
                    "file name is not correct, it should be in this format: name.gcode . Only allowed characters are [a-zA-Z0-9_]"
                )
            }
            fs.unlink(path.join(this.storageLocation, name), (err) => {
                if (err) {
                    return reject(err)
                }
                return resolve()
            })
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

    listLogs(priority: LogPriority[], amount: number): Promise<LogEntry[]> {
        if (!amount) {
            amount = 50
        }
        return new Promise((resolve, reject) => {
            let priorityWhere =
                "WHERE " + priority.map((p) => "priority = " + p).join(" OR ")
            this.db.all(
                "SELECT * FROM logs " +
                    priorityWhere +
                    " order by date desc limit " +
                    amount,
                (err, rows) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(
                        rows.map((row) => {
                            let priority: LogPriority
                            switch (row.priority) {
                                case LogPriority.Debug:
                                    priority = LogPriority.Debug
                                    break
                                case LogPriority.Error:
                                    priority = LogPriority.Error
                                    break
                                case LogPriority.Warning:
                                    priority = LogPriority.Warning
                            }
                            return new LogEntry(
                                priority,
                                row.details,
                                row.shortDescription,
                                new Date(row.date)
                            )
                        })
                    )
                }
            )
        })
    }

    storeNotification(
        id: string,
        content: string,
        type: NotificationType,
        time: Date
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare(
                "insert into notification (id, content, type, date) values (?, ?, ?, ?)"
            )
            statement.run(id, content, type, time, (err: Error) => {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }

    listNotifications(): Promise<
        {
            id: string
            content: string
            date: Date
            type: NotificationType
            dismissed: boolean
            dismissTime?: Date
        }[]
    > {
        return new Promise((resolve, reject) => {
            this.db.all("select * from notification", (err: Error, rows) => {
                if (err) {
                    return reject(err)
                }
                rows.map((row) => {
                    row.date = new Date(row.date)
                    return row
                })
                resolve(rows)
            })
        })
    }

    dismissNotification(id: string, state: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            let statement = this.db.prepare(
                "update notification set dismissed = " +
                    state.toString() +
                    ", dismissTime = datetime('now') where id = ?"
            )
            statement.run(id, (err: Error) => {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }
}
