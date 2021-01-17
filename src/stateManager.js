const globals = require("./globals")
const SerialConnectionManager = require("./serial")
const Webserver = require("./webserver")

module.exports = class Manager {
    constructor() {
        this.state = globals.CONNECTIONSTATE.DISCONNECTED
        this.printers = new Map()
        this.connectionManager = new SerialConnectionManager(this)
        this.webserver = new Webserver()
    }
}
