const globals = require("./globals")
const SerialConnectionManager = require("./serial")

module.exports = class Manager {
    #state
    constructor() {
        this.#state = globals.CONNECTIONSTATE.DISCONNECTED
        this.printers = new Map()
        this.connectionManager = new SerialConnectionManager()
    }
}
