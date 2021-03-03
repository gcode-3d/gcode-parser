import express from "express"
import { v4 as uuid } from "uuid"
import WebSocket from "ws"
import fileUpload, { UploadedFile } from "express-fileupload"
import bodyParser from "body-parser"
import loginScheme from "./schemes/login.js"
import setupScheme from "./schemes/setupNew.js"
import { IncomingMessage, Server } from "http"
import StateManager from "./stateManager.js"
import ExtWebSocket from "./interfaces/websocket"
import { Socket } from "net"
import ActionManager from "./classes/actionManager.js"
import UserTokenResult from "./classes/UserTokenResult.js"
import device from "./classes/device.js"
import setupWizard from "./tools/setupWizard.js"
const gitHash = require("child_process")
    .execSync("git rev-parse HEAD")
    .toString()
    .trim()
let isTestingConnection = false
export default class Webserver {
    app: express.Application
    stateManager: StateManager
    server: Server
    wss: WebSocket.Server
    actionManager: ActionManager
    isInSetupMode: boolean
    constructor(stateManager: StateManager) {
        this.isInSetupMode = false
        this.app = express()
        this.app.use(
            bodyParser.urlencoded({
                extended: true,
                limit: 3000,
                parameterLimit: 10,
            })
        )
        this.app.use(
            fileUpload({
                limits: 20 * 1024 * 1024,
            })
        )
        this.app.use(function (_, res, next) {
            res.setHeader("Access-Control-Allow-Origin", "*")
            res.setHeader("Access-Control-Allow-Methods", "GET, POST")
            res.setHeader(
                "Access-Control-Allow-Headers",
                "X-Requested-With,content-type, Authorization"
            )
            next()
        })
        this.stateManager = stateManager
        this.actionManager = new ActionManager(this.stateManager)
        this.stateManager.storage
            .needsSetup()
            .then((needsSetup) => {
                this.isInSetupMode = needsSetup
                if (needsSetup) {
                    console.log("[Setup] Setup required. Enabling setup mode.")
                }

                this.setupRoutes()
                this.server = this.app.listen(
                    process.env.NODE_ENV === "production"
                        ? stateManager.config.serverPortPROD
                        : stateManager.config.serverPortDEV
                )
                this.wss = this.createWSS()
            })
            .catch(console.error)
    }

    setupRoutes() {
        if (process.env.NODE_ENV === "production") {
            this.app.use((_, res, next) => {
                res.setHeader("X-Version", gitHash)
                next()
            })

            if (this.isInSetupMode) {
                setupWizard()
                    .then((location: string) => {
                        this.app.use(express.static(location))
                    })
                    .catch((e: Error) => {
                        throw e
                    })
            } else {
                this.app.use(express.static("build"))
            }
        }
        this.app.get("/api/ping", (_, res) => {
            res.status(200).send("Pong")
        })

        this.app.post("/api/submitSetup", async (req, res) => {
            console.log("submit called")
            console.log(req.body)
        })

        this.app.get("/api/fetchDevices", async (req, res) => {
            try {
                let userInfo

                if (!this.isInSetupMode) {
                    if (!req.headers.authorization) {
                        return res.sendStatus(401)
                    }
                    if (!req.headers.authorization.startsWith("auth-")) {
                        return res.sendStatus(401)
                    }
                    var token = req.headers.authorization.replace("auth-", "")
                    userInfo = await this.stateManager.storage.validateToken(
                        token
                    )
                } else {
                    userInfo = new UserTokenResult("SETUP", null, 1)
                }
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (
                    permissions["admin"] ||
                    (permissions["connection.edit"] &&
                        permissions["settings.edit"])
                ) {
                    this.stateManager.connectionManager
                        .list()
                        .then((list: any) => {
                            return res.json(list)
                        })
                        .catch((e: any) => {
                            console.error(e)
                        })
                } else {
                    return res.sendStatus(403)
                }
            } catch (e) {
                console.error(e)
                res.sendStatus(500)
            }
        })

        this.app.post("/api/file/rename", async (req, res) => {
            try {
                var token = req.headers.authorization.replace("auth-", "")
                var userInfo = await this.stateManager.storage.validateToken(
                    token
                )
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (!permissions["file.edit"] && !permissions["admin"]) {
                    return res.sendStatus(401)
                }
                if (!req.body || !req.body.new_name || !req.body.old_name) {
                    return res.sendStatus(400)
                }
                const old_exists = await this.stateManager.storage.checkFileExistsByName(
                    req.body.old_name
                )
                if (!old_exists) {
                    return res.status(404).send("This file doesn't exist.")
                }
                const new_exists = await this.stateManager.storage.checkFileExistsByName(
                    req.body.new_name
                )
                if (!new_exists) {
                    return res
                        .status(400)
                        .send("The new filename exists already.")
                }
                if (new TextEncoder().encode(req.body.new_name).length > 250) {
                    return res.status(400).send("New filename is too large")
                }
                await this.stateManager.storage.updateFileName(
                    req.body.old_name,
                    req.body.new_name
                )
                res.sendStatus(200)
            } catch (e) {
                console.error(e)
                return res.sendStatus(500)
            }
        })

        this.app.get("/api/files/", async (req, res) => {
            try {
                var token = req.headers.authorization.replace("auth-", "")
                var userInfo = await this.stateManager.storage.validateToken(
                    token
                )
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (!permissions["file.access"] && !permissions["admin"]) {
                    return res.sendStatus(401)
                }
                var files = await this.stateManager.storage.getFileList()
                return res.json(files)
            } catch (e) {
                console.error(e)
                return res.sendStatus(500)
            }
        })

        this.app.get("/api/file/:file", async (req, res) => {
            try {
                var token = req.headers.authorization.replace("auth-", "")
                var userInfo = await this.stateManager.storage.validateToken(
                    token
                )
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (!permissions["file.access"] && !permissions["admin"]) {
                    return res.sendStatus(401)
                }
                if (!req.params.file) {
                    return res.sendStatus(400)
                }

                const exists = await this.stateManager.storage.checkFileExistsByName(
                    req.params.file
                )
                if (!exists) {
                    return res.status(404).send("This file doesn't exist.")
                }

                var file = await this.stateManager.storage.getFileByName(
                    req.params.file
                )
                res.setHeader("X-filename", file.name)
                res.setHeader("X-upload-date", file.uploaded.toISOString())
                res.send(file.data.toString("ascii"))
            } catch (e) {
                console.error(e)
                return res.sendStatus(500)
            }
        })

        this.app.delete("/api/file/:file", async (req, res) => {
            try {
                var token = req.headers.authorization.replace("auth-", "")
                var userInfo = await this.stateManager.storage.validateToken(
                    token
                )
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (!permissions["file.edit"] && !permissions["admin"]) {
                    return res.sendStatus(401)
                }
                if (!req.params.file) {
                    return res.sendStatus(400)
                }

                const exists = await this.stateManager.storage.checkFileExistsByName(
                    req.params.file
                )
                if (!exists) {
                    return res.status(404).send("This file doesn't exist.")
                }

                await this.stateManager.storage.removeFileByName(
                    req.params.file
                )
                res.sendStatus(200)
            } catch (e) {
                console.error(e)
                return res.sendStatus(500)
            }
        })

        this.app.put("/api/files/", async (req, res) => {
            try {
                var token = req.headers.authorization.replace("auth-", "")
                var userInfo = await this.stateManager.storage.validateToken(
                    token
                )
                if (!userInfo) {
                    return res.sendStatus(401)
                }
                userInfo = userInfo as UserTokenResult
                const permissions = userInfo.permissions.serialize()
                if (!permissions["file.edit"] && !permissions["admin"]) {
                    return res.sendStatus(401)
                }

                if (!req.files || Object.keys(req.files).length === 0) {
                    return res.status(400).send("No files were uploaded.")
                } else if (Object.keys(req.files).length !== 1) {
                    return res.status(400).send("Only upload 1 file at a time.")
                } else if (!req.files["file"]) {
                    return res.status(400).send("NO files were uploaded.")
                }

                let file = req.files["file"] as UploadedFile
                if (file.truncated) {
                    return res.sendStatus(413)
                }
                const exists = await this.stateManager.storage.checkFileExistsByName(
                    file.name
                )
                if (exists) {
                    return res.status(409).send("This file already exists.")
                }
                this.stateManager.storage
                    .insertFile(file.name, file.data)
                    .then(() => {
                        res.sendStatus(200)
                    })
                    .catch((e) => {
                        console.error(e)
                        res.sendStatus(500)
                    })
            } catch (e) {
                console.error(e)
                res.sendStatus(500)
            }
        })

        this.app.post("/api/setup", (req, res) => {
            if (!req.headers.authorization) {
                return res.sendStatus(401)
            }
            if (!req.headers.authorization.startsWith("auth-")) {
                return res.sendStatus(401)
            }
            var token = req.headers.authorization.replace("auth-", "")
            this.stateManager.storage
                .validateToken(token)
                .then((userInfo: boolean | UserTokenResult) => {
                    if (!userInfo) {
                        return res.sendStatus(401)
                    }
                    userInfo = userInfo as UserTokenResult
                    const permissions = userInfo.permissions.serialize()
                    if (
                        permissions["admin"] ||
                        (permissions["connection.edit"] &&
                            permissions["settings.edit"])
                    ) {
                        if (isTestingConnection) {
                            return res.status(503).json(
                                JSON.stringify({
                                    error: true,
                                    message:
                                        "Server is already occupied setting up another device",
                                })
                            )
                        }
                        isTestingConnection = true
                        setupScheme
                            .validateAsync(req.body)
                            .then((value: any) => {
                                var test =
                                    value.baudRate == "Auto"
                                        ? this.stateManager.connectionManager.getBaudrate(
                                              value.path
                                          )
                                        : this.stateManager.connectionManager.testConnection(
                                              value.path,
                                              value.baudRate
                                          )
                                test.then((result: boolean) => {
                                    if (
                                        value.baudRate == "Auto" &&
                                        result == false
                                    ) {
                                        isTestingConnection = false
                                        return res.json(
                                            JSON.stringify({
                                                error: true,
                                                message:
                                                    "Connection to printer failed",
                                            })
                                        )
                                    }
                                    isTestingConnection = false
                                    this.stateManager.storage
                                        .saveDevice(
                                            new device(
                                                value.name,
                                                value.width,
                                                value.depth,
                                                value.height,
                                                value.path,
                                                value.baudRate == "Auto"
                                                    ? result
                                                    : value.baudRate
                                            )
                                        )
                                        .then(() => {
                                            res.status(200).json(
                                                JSON.stringify({
                                                    error: false,
                                                    message: "Success",
                                                })
                                            )
                                        })
                                        .catch((e: any) => {
                                            console.error(e)
                                            res.status(500).json(
                                                JSON.stringify({
                                                    error: true,
                                                    message:
                                                        "Failed to save configuration. Try again later.",
                                                })
                                            )
                                        })
                                }).catch((e: any) => {
                                    console.error(e)
                                    isTestingConnection = false
                                    return res.json(
                                        JSON.stringify({
                                            error: true,
                                            message:
                                                "Connection to printer failed",
                                        })
                                    )
                                })
                            })
                            .catch((e: any) => {
                                console.error(e)
                                isTestingConnection = false
                                res.sendStatus(500)
                            })
                    } else {
                        return res.sendStatus(403)
                    }
                })
                .catch((e: any) => {
                    console.error(e)
                    res.sendStatus(500)
                })
        })
        this.app.post("/api/login", (req, res) => {
            loginScheme
                .validateAsync(req.body)
                .then(async (value: any) => {
                    let date = new Date(value.datetime)
                    let dateDiff = new Date().getTime() - date.getTime()
                    if (dateDiff > 5000 || dateDiff < 0) {
                        return res.sendStatus(400)
                    }

                    var result = await this.stateManager.storage.validateUser(
                        value.username,
                        value.password
                    )
                    if (!result) {
                        return res.json({
                            error: true,
                            message: "Invalid username / password",
                        })
                    }
                    var token = await this.stateManager.storage.generateNewToken(
                        value.username,
                        value.remember
                    )
                    // pass token to client
                    return res.json({ token })
                })
                .catch((e: any) => {
                    console.log(e)
                    if (e.details) {
                        let detail = e.details[0]
                        if (detail.context.key == "datetime") {
                            return res.sendStatus(400)
                        } else {
                            return res.json({
                                error: true,
                                message: detail.message.replace(/"/g, ""),
                            })
                        }
                    }
                    return res.json({
                        error: true,
                        message:
                            "Something went wrong while logging you in. Try again later.",
                    })
                })
        })
    }

    createWSS(): WebSocket.Server {
        const wss = new WebSocket.Server({
            noServer: true,
            maxPayload: 3000,
        })
        this.server.on(
            "upgrade",
            async (request: IncomingMessage, socket: Socket, head: Buffer) => {
                if (!request.headers["sec-websocket-protocol"]) {
                    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
                    socket.destroy()
                    return
                } else if (
                    !request.headers["sec-websocket-protocol"].startsWith(
                        "auth-"
                    )
                ) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
                    socket.destroy()
                    return
                }
                var token = request.headers["sec-websocket-protocol"].replace(
                    "auth-",
                    ""
                )
                this.stateManager.storage
                    .validateToken(token)
                    .then((userInfo: any) => {
                        if (!userInfo) {
                            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
                            socket.destroy()
                            return
                        }
                        wss.handleUpgrade(
                            request,
                            socket,
                            head,
                            (ws: ExtWebSocket) => {
                                ws.userInfo = userInfo
                                wss.emit("connection", ws, request)
                            }
                        )
                    })
                    .catch((e: any) => {
                        console.error(e)
                        socket.write(
                            "HTTP/1.1 500 Internal Server Error\r\n\r\n"
                        )
                        socket.destroy()
                        return
                    })
            }
        )
        wss.on("connection", async (socket: ExtWebSocket) => {
            socket.sendJSON = function (json: any) {
                socket.send(JSON.stringify(json))
            }
            socket.id = uuid()
            console.log("[WS][Event] Connection opened with " + socket.id)

            const currentState = this.stateManager.getCurrentStateInfo()
            const devices = await this.stateManager.storage.listDeviceConfigNames()
            socket.sendJSON({
                type: "ready",
                content: {
                    setup: devices.length == 0,
                    user: {
                        username: socket.userInfo.username,
                        permissions: socket.userInfo.permissions.serialize(),
                    },
                    ...currentState,
                },
            })
            socket.on(
                "message",
                (
                    data:
                        | string
                        | Uint8Array
                        | Uint8ClampedArray
                        | Uint16Array
                        | Uint32Array
                        | Int8Array
                        | Int16Array
                        | Int32Array
                        | BigUint64Array
                        | BigInt64Array
                        | Float32Array
                        | Float64Array
                        | DataView
                        | ArrayBuffer
                        | SharedArrayBuffer
                ) => {
                    if (!socket.userInfo) {
                        return socket.close()
                    }
                    if (typeof data != "string") {
                        return
                    }
                    try {
                        let jsonMessage: {
                            action: string
                            data: object
                        } = JSON.parse(data as string)

                        this.actionManager.execute(
                            socket.userInfo,
                            jsonMessage.action,
                            jsonMessage.data
                        )
                    } catch (e) {
                        console.log(e)
                    }
                }
            )
        })

        wss.on("error", function (error) {
            console.log("[WS][Error] " + error)
        })

        wss.on("close", function (error: any) {
            console.log("[WS][Event] Server closed")
        })
        return wss
    }
    sendTemperatureToClients(data: {
        tools: { name: number; currentTemp: number; targetTemp: number }[]
        bed: { currentTemp: number; targetTemp: number }
        chamber: any
    }) {
        this.wss.clients.forEach(function (socket: ExtWebSocket) {
            socket.sendJSON({
                type: "temperature_change",
                data,
            })
        })
    }
    sendMessageToClients(data: any) {
        this.wss.clients.forEach(function (socket: ExtWebSocket) {
            socket.sendJSON({
                type: "message_receive",
                data,
            })
        })
    }
}
