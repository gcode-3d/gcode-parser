const express = require("express")
const { v4: uuid } = require("uuid")
const WebSocket = require("ws")
const bodyParser = require("body-parser")
const loginScheme = require("./input/login")

module.exports = class Webserver {
    constructor(stateManager) {
        this.app = express()
        this.app.use(
            bodyParser.urlencoded({
                extended: true,
                limit: 3000,
                parameterLimit: 10,
            })
        )
        this.stateManager = stateManager
        this.setupRoutes()
        this.server = this.app.listen(stateManager.config.serverPort)
        this.handlers = []
        this.wss = this.createWSS()
    }
    registerHandler(callback) {
        this.handlers.push(callback)
    }

    setupRoutes() {
        this.app.get("/api/ping", (_, res) => {
            res.status(200).send("Pong")
        })
        this.app.post("/api/login", (req, res) => {
            console.log(req.rateLimit)
            loginScheme
                .validateAsync(req.body)
                .then(async (value) => {
                    console.log(value)
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
                    res.json({ token })
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

    createWSS() {
        const wss = new WebSocket.Server({
            noServer: true,
            maxPayload: 3000,
        })
        this.server.on(
            "upgrade",
            async function (request, socket, head) {
                console.log("upgrade")
                // console.log(request.headers)
                if (!request.headers["sec-websocket-protocol"]) {
                    return res.sendStatus(400)
                } else if (
                    !request.headers["sec-websocket-protocol"].startsWith(
                        "auth-"
                    )
                ) {
                    return res.sendStatus(401)
                }
                var token = request.headers["sec-websocket-protocol"].replace(
                    "auth-",
                    ""
                )
                this.stateManager.storage
                    .validateToken(token)
                    .then((userInfo) => {
                        if (!userInfo) {
                            return res.sendStatus(401)
                        }
                        wss.handleUpgrade(request, socket, head, (ws) => {
                            ws.userInfo = userInfo
                            wss.emit("connection", ws, request)
                        })
                    })
                    .catch((e) => {
                        console.error(e)
                        res.sendStatus(500)
                    })
            }.bind(this)
        )
        wss.on(
            "connection",
            function (socket) {
                socket.sendJSON = function (json) {
                    socket.send(JSON.stringify(json))
                }
                socket.id = uuid()
                console.log("[WS][Event] Connection opened with " + socket.id)

                const currentState = this.stateManager.getCurrentStateInfo()
                socket.sendJSON({
                    type: "ready",
                    content: {
                        user: {
                            username: socket.userInfo.username,
                            permissions: socket.userInfo.permissions.serialize(),
                        },
                        ...currentState,
                    },
                })
                socket.on(
                    "message",
                    function (data) {
                        console.log(`Message: ${Buffer.byteLength(data)} bytes`)
                        this.handlers.forEach((i) => i(data))
                    }.bind(this)
                )
            }.bind(this)
        )

        wss.on("error", function (error) {
            console.log("[WS][Error] " + error)
        })

        wss.on("close", function (error) {
            console.log("[WS][Event] Server closed")
        })
        return wss
    }
    sendTemperatureToClients(data) {
        this.wss.clients.forEach(function (socket) {
            socket.sendJSON({
                type: "temperature_change",
                data,
            })
        })
    }
    sendMessageToClients(data) {
        this.wss.clients.forEach(function (socket) {
            socket.sendJSON({
                type: "message_receive",
                data,
            })
        })
    }
}
