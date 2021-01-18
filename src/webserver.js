const express = require("express")
const { v4: uuid } = require("uuid")
const WebSocket = require("ws")
const path = require("path")

module.exports = class Webserver {
    constructor(stateManager) {
        this.app = express()
        this.stateManager = stateManager
        this.setupRoutes()
        this.server = this.app.listen(8080)
        this.handlers = []
        this.wss = this.createWSS()
    }
    registerHandler(callback) {
        this.handlers.push(callback)
    }

    setupRoutes() {
        this.app.get("/", function (req, res) {
            res.sendFile(path.join(__dirname, "./web/html/index.html"))
        })

        this.app.get("/files/js/ws.js", function (req, res) {
            res.sendFile(path.join(__dirname, "./web/js/ws.js"))
        })
        this.app.get("/files/style/index.css", function (req, res) {
            res.sendFile(path.join(__dirname, "./web/style/index.css"))
        })
    }

    createWSS() {
        const wss = new WebSocket.Server({
            server: this.server,
        })

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
                    content: currentState,
                })
                socket.on(
                    "message",
                    function (data) {
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
