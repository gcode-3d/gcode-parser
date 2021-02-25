import Parser from "./parser.js"
import Webserver from "./webserver.js"
import globals from "./globals.js"
import Printer from "./serial/printer.js"
import Storage from "./storage.js"
import ExtWebSocket from "./interfaces/websocket"
import SerialConnectionManager from "./serial/index.js"
import * as config from "../config.json"

export default class StateManager {
    state: any
    config: config
    printer: Printer | null
    storage: Storage
    connectionManager: SerialConnectionManager
    parser: Parser
    webserver: Webserver
    additionalStateInfo: any

    constructor() {
        this.state = globals.CONNECTIONSTATE.DISCONNECTED
        this.config = config
        this.printer = null
        this.storage = new Storage()
        this.connectionManager = new SerialConnectionManager(this)
        this.parser = new Parser(this)
        this.webserver = new Webserver(this)
        this.additionalStateInfo = {}
    }

    createPrinter(capabilities) {
        this.printer = new Printer(this, capabilities)

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
                    description: this.additionalStateInfo.errorDescription,
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

    updateState(state, extraDescription: any) {
        this.state = state
        this.additionalStateInfo = extraDescription
        this.webserver.wss.clients.forEach((socket: ExtWebSocket) => {
            socket.sendJSON({
                type: "state_update",
                content: state,
                description: extraDescription || null,
            })
        })
    }
}
