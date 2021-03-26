import express from "express"
import { v4 as uuid } from "uuid"
import WebSocket from "ws"
import { IncomingMessage, Server } from "http"
import StateManager from "./stateManager.js"
import ExtWebSocket from "./interfaces/websocket"
import { Socket } from "net"
import ActionManager from "./classes/actionManager.js"
import path from "path"
import { readdir } from "fs"
import Route from "./classes/route.js"
import setupWizard from "./tools/setupWizard.js"

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

        this.stateManager = stateManager
        this.actionManager = new ActionManager(this.stateManager)
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

    createRoutes() {
        if (process.env.NODE_ENV === "production") {
            if (this.isInSetupMode) {
                setupWizard()
                    .then((location: string) => {
                        this.app.use(
                            express.static(location, { fallthrough: true })
                        )
                    })
                    .catch((e: Error) => {
                        throw e
                    })
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
    sendTemperatureToClients(data: tempInfo) {
        this.wss.clients.forEach(function (socket: ExtWebSocket) {
            socket.sendJSON({
                type: "temperature_change",
                content: data,
            })
        })
    }
    sendMessageToClients(message: string, type: string) {
        this.wss.clients.forEach(function (socket: ExtWebSocket) {
            socket.sendJSON({
                type: "message_receive",
                content: {
                    type,
                    message,
                },
            })
        })
    }
}
