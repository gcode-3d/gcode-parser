import express from "express"
import { v4 as uuid } from "uuid"
import WebSocket from "ws"
import bodyParser from "body-parser"
import loginScheme from "./schemes/login.js"
import setupScheme from "./schemes/setupNew.js"
import { IncomingMessage, Server } from "http"
import StateManager from "./stateManager.js"
import ExtWebSocket from "./interfaces/websocket"
import { Socket } from "net"

let isTestingConnection = false
export default class Webserver {
    app: express.Application
    stateManager: any
    server: Server
    handlers: { (message: any): void }[]
    wss: WebSocket.Server
    constructor(stateManager: StateManager) {
        this.app = express()
        this.app.use(
            bodyParser.urlencoded({
                extended: true,
                limit: 3000,
                parameterLimit: 10,
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
        this.setupRoutes()
        this.server = this.app.listen(
            process.env.NODE_ENV === "production"
                ? stateManager.config.serverPortPROD
                : stateManager.config.serverPortDEV
        )
        this.handlers = []
        this.wss = this.createWSS()
    }
    registerHandler(callback: (message: string) => void) {
        this.handlers.push(callback)
    }

    setupRoutes() {
        if (process.env.NODE_ENV === "production") {
            this.app.use(express.static("build"))
        }
        this.app.get("/api/ping", (_, res) => {
            res.status(200).send("Pong")
        })
        this.app.get("/api/fetchDevices", (req, res) => {
            if (!req.headers.authorization) {
                return res.sendStatus(401)
            }
            if (!req.headers.authorization.startsWith("auth-")) {
                return res.sendStatus(401)
            }
            var token = req.headers.authorization.replace("auth-", "")
            this.stateManager.storage
                .validateToken(token)
                .then((userInfo: { permissions: { serialize: () => any } }) => {
                    if (!userInfo) {
                        return res.sendStatus(401)
                    }
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
                })
                .catch((e: any) => {
                    console.error(e)
                    res.sendStatus(500)
                })
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
                .then((userInfo: { permissions: { serialize: () => any } }) => {
                    if (!userInfo) {
                        return res.sendStatus(401)
                    }
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
                            .then((value) => {
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
                                            value.name,
                                            value.width,
                                            value.depth,
                                            value.height,
                                            value.path,
                                            value.baudRate == "Auto"
                                                ? result
                                                : value.baudRate
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
                            .catch((e) => {
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
                .then(async (value) => {
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
                .catch((e) => {
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
        wss.on(
            "connection",
            async (socket: {
                sendJSON: {
                    (arg0: { type: string; content: any }): void
                    (json: any): void
                }
                send: (arg0: string) => void
                id: string
                userInfo: {
                    username: any
                    permissions: { serialize: () => any }
                }
                on: (arg0: string, arg1: any) => void
            }) => {
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
                        console.log(`Message: ${Buffer.byteLength(data)} bytes`)
                        this.handlers.forEach((i: (arg0: any) => any) =>
                            i(data)
                        )
                    }
                )
            }
        )

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
