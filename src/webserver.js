const express = require("express")
const WebSocket = require("ws")
const path = require("path")

module.exports = class Webserver {
    constructor() {
        this.app = express()

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
                console.log("[WS][Event] Connection opened with " + socket.id)
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
    sendToClients(content) {
        this.wss.clients.forEach(function (socket) {
            socket.send(content)
        })
    }
}
