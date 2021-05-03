import express from "express"
import { v4 as uuid } from "uuid"
import WebSocket from "ws"
import { IncomingMessage, Server } from "http"
import StateManager from "./stateManager.js"
import ExtWebSocket from "./interfaces/websocket"
import { Socket } from "net"
import path from "path"
import { readdir } from "fs"
import Route from "./classes/route.js"
import setupWizard from "./tools/setupWizard.js"
import Device from "./classes/device.js"
import Setting from "./enums/setting.js"
import NotificationType from "./enums/notificationType.js"

export default class Webserver {
    app: express.Application
    stateManager: StateManager
    server: Server
    wss: WebSocket.Server
    isInSetupMode: boolean
    messageStore: {
        id: string
        message: string
        type: string
        time: Date
    }[] = []
    constructor(stateManager: StateManager) {
        this.isInSetupMode = false
        this.app = express()

        this.stateManager = stateManager
        this.stateManager.storage
            .needsSetup()
            .then((needsSetup) => {
                this.isInSetupMode = needsSetup
                if (needsSetup) {
                    console.log("[Setup] Setup required. Enabling setup mode.")
                }

                this.createRoutes()
                this.server = this.app.listen(
                    process.env.NODE_ENV === "production"
                        ? stateManager.config.serverPortPROD
                        : stateManager.config.serverPortDEV
                )
                this.wss = this.createWSS()
            })
            .catch(console.error)
    }

    async createRoutes() {
        console.log("Creating routes")
        if (process.env.NODE_ENV === "production") {
            if (this.isInSetupMode) {
                console.log("Creating routes - setup")
                let location = await setupWizard()
                console.log(location)
                this.app.use(express.static(location, { fallthrough: true }))
            } else {
                this.app.use(
                    express.static("build/client", { fallthrough: true })
                )
            }
        }
        readdir(path.join(__dirname, "routes"), async (err, routePaths) => {
            if (err) {
                throw err
            }
            let routes: { default: Route }[] = await Promise.all(
                routePaths.map(
                    (route) => import(path.join(__dirname, "routes", route))
                )
            )
            routes = routes.filter((route) =>
                this.isInSetupMode == true
                    ? route.default.setupType > 0
                    : route.default.setupType != 1
            )
            let routeTypes = {
                // Middleware that should be registered before routes are registered
                middlewareBeforeRegistering: routes.filter(
                    (route) =>
                        route.default.method === "MIDDLEWARE" &&
                        route.default.path == "1"
                ),
                // Middleware that should be registered after routes are registered
                middlewareAfterRegistering: routes.filter(
                    (route) =>
                        route.default.method === "MIDDLEWARE" &&
                        route.default.path == "-1"
                ),
                // Regular routes.
                regular: routes.filter(
                    (route) => route.default.method !== "MIDDLEWARE"
                ),
            }
            routes = [
                ...routeTypes.middlewareBeforeRegistering,
                ...routeTypes.regular,
                ...routeTypes.middlewareAfterRegistering,
            ]

            routes.forEach((routeObject) => {
                let route = routeObject.default
                if (route.method === "MIDDLEWARE") {
                    this.app.use((req, res, next) =>
                        route.handler(req, res, this, next)
                    )
                } else {
                    console.log(
                        `[ROUTE] Registering [${route.method}] ` + route.path
                    )
                    switch (route.method) {
                        case "GET":
                            this.app.get(route.path, (req, res) =>
                                route.handler(req, res, this)
                            )
                            break
                        case "POST":
                            this.app.post(route.path, (req, res) =>
                                route.handler(req, res, this)
                            )
                            break
                        case "DELETE":
                            this.app.delete(route.path, (req, res) =>
                                route.handler(req, res, this)
                            )
                            break
                        case "PUT":
                            this.app.put(route.path, (req, res) =>
                                route.handler(req, res, this)
                            )
                            break
                        default:
                            throw (
                                "Route " +
                                route.path +
                                " uses unknown method " +
                                route.method
                            )
                    }
                }
            })
        })
    }

    createWSS(): WebSocket.Server {
        const wss = new WebSocket.Server({
            noServer: true,
            maxPayload: 3000,
        })
        this.createIntervals()
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
                            return wss.handleUpgrade(
                                request,
                                socket,
                                head,
                                (ws: WebSocket) => {
                                    return ws.close(4001, "4001 Unauthorized")
                                }
                            )
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
            let settings = await this.stateManager.storage.getSettings()
            let device: Device = null

            if (settings.get(Setting.SelectedDevice)) {
                device = await this.stateManager.storage.getDeviceByName(
                    settings.get(Setting.SelectedDevice) as string
                )
            }
            socket.sendJSON({
                type: "ready",
                content: {
                    user: {
                        username: socket.userInfo.username,
                        permissions: socket.userInfo.permissions.serialize(),
                    },
                    currentPrinter: device ? device : undefined,
                    ...currentState,
                },
            })
        })

        wss.on("error", function (error) {
            console.log("[WS][Error] " + error)
        })

        wss.on("close", function (error: any) {
            console.log("[WS][Event] Server closed")
        })
        return wss
    }

    private createIntervals() {
        setInterval(() => {
            if (this.messageStore.length == 0) {
                return
            }
            this.wss.clients.forEach((socket: ExtWebSocket) => {
                if (
                    !socket.userInfo.permissions.hasPermission("terminal.read")
                ) {
                    return
                }
                socket.sendJSON({
                    type: "message_receive",
                    content: this.messageStore,
                })
            })
            this.messageStore = []
        }, 1000)
    }
    sendTemperatureToClients(data: tempInfo) {
        this.wss.clients.forEach(function (socket: ExtWebSocket) {
            socket.sendJSON({
                type: "temperature_change",
                content: data,
            })
        })
    }
    sendSettingUpdateEvent(setting_name: string, setting_value: string) {
        this.wss.clients.forEach((socket: ExtWebSocket) => {
            if (!socket.userInfo.permissions.hasPermission("settings.edit")) {
                return
            }
            socket.sendJSON({
                type: "setting_update",
                content: {
                    setting_name,
                    setting_value,
                },
            })
        })
    }
    sendMessageToClients(message: string, type: string, id: string) {
        this.messageStore.push({ message, type, id, time: new Date() })
    }

    sendNotification(type: NotificationType, content: string) {
        let id = uuid()
        let date = new Date()
        this.stateManager.storage
            .storeNotification(id, content, type, new Date())
            .then(() => {
                this.wss.clients.forEach((client: ExtWebSocket) => {
                    client.sendJSON({
                        type: "notification",
                        content: {
                            id,
                            timestamp: date.getTime(),
                            type,
                            content,
                        },
                    })
                })
            })
    }
}
