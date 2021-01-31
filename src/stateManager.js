const globals = require("./globals")
const SerialConnectionManager = require("./serial")
const Webserver = require("./webserver")
const Parser = require("./parser/")
const Printer = require("./serial/printer.js")
const Storage = require("./storage")
const printerProfile = require("../printerProfile.json")

module.exports = class Manager {
    constructor() {
        this.state = globals.CONNECTIONSTATE.DISCONNECTED
        this.config = require("../config.json")
        this.printer = null
        this.storage = new Storage()
        this.connectionManager = new SerialConnectionManager(this)
        this.parser = new Parser(this)
        this.webserver = new Webserver(this)
        this.additionalStateInfo = {}
        this.loops = {}
    }

    createPrinter(capabilities) {
        this.printer = new Printer(this, printerProfile, capabilities)

        this.printer.updateCapabilities(capabilities)
    }

    getCurrentStateInfo() {
        switch (this.state) {
            case globals.CONNECTIONSTATE.DISCONNECTED:
                return {
                    state: "Disconnected",
                }
            case globals.CONNECTIONSTATE.CONNECTED:
                return {
                    state: "Connected",
                    print: null,
                }
            case globals.CONNECTIONSTATE.CONNECTING:
                return {
                    state: "Connecting",
                }
            case globals.CONNECTIONSTATE.ERRORED:
                return {
                    state: "Errored",
                    description: this.additionalStateInfo.errorDescription
                        ? this.additionalStateInfo.errorDescription
                        : null,
                }
            case globals.CONNECTIONSTATE.PREPARING:
                return {
                    state: "Preparing print",
                }
            case globals.CONNECTIONSTATE.PRINTING:
                return {
                    state: "Printing",
                    description: this.additionalStateInfo.printInfo
                        ? this.additionalStateInfo.printInfo
                        : null,
                }
            case globals.CONNECTIONSTATE.FINISHING:
                return {
                    state: "Finishing",
                }
        }
    }

    updateState(state, extraDescription) {
        this.state = state
        this.extraDescription = extraDescription
        this.webserver.wss.clients.forEach((client) => {
            client.sendJSON({
                type: "state_update",
                content: state,
            })
        })
    }
}
