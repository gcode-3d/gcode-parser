import Parser from "./parser.js"
import Webserver from "./webserver.js"
import globals from "./globals.js"
import Printer from "./serial/printer.js"
import Storage from "./storage.js"
import ExtWebSocket from "./interfaces/websocket"
import SerialConnectionManager from "./serial/index.js"
import * as config from "../config.json"
import PrintManager from "./classes/printManager.js"
import stateInfo from "./interfaces/stateInfo"

export default class StateManager {
    state: number
    config: config
    printer: Printer | null
    storage: Storage
    connectionManager: SerialConnectionManager
    printManager: PrintManager
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
        this.printManager = new PrintManager(this)
    }

    createPrinter(capabilities: Map<string, boolean | string>): Promise<void> {
        return new Promise((resolve, reject) => {
            this.printer = new Printer(this, capabilities)
            this.printer.manageCapabilityValues().then(resolve).catch(reject)
        })
    }

    getCurrentStateInfo(): stateInfo {
        switch (this.state) {
            case globals.CONNECTIONSTATE.DISCONNECTED:
                return {
                    state: "Disconnected",
                }
            case globals.CONNECTIONSTATE.CONNECTED:
                return {
                    state: "Connected",
                    description: null,
                }
            case globals.CONNECTIONSTATE.CONNECTING:
                return {
                    state: "Connecting",
                }
            case globals.CONNECTIONSTATE.ERRORED:
                return {
                    state: "Errored",
                    description: {
                        errorDescription: this.additionalStateInfo
                            .errorDescription,
                    },
                }
            case globals.CONNECTIONSTATE.PREPARING:
                return {
                    state: "Preparing print",
                }
            case globals.CONNECTIONSTATE.PRINTING:
                return {
                    state: "Printing",
                    description: {
                        printInfo: this.additionalStateInfo.printInfo,
                    },
                }
            case globals.CONNECTIONSTATE.FINISHING:
                return {
                    state: "Finishing",
                }
        }
    }

    updateState(state: number, extraDescription: stateInfo["description"]) {
        this.state = state
        this.additionalStateInfo = extraDescription
        this.webserver.wss?.clients.forEach((socket: ExtWebSocket) => {
            socket.sendJSON({
                type: "state_update",
                content: {
                    state: getStateName(state),
                    description: extraDescription || null,
                },
            })
        })
    }

    throwError(errorMessage: string) {
        if (!this.connectionManager.connection.destroyed) {
            this.connectionManager.connection.close((err) => {
                if (err) {
                    this.updateState(globals.CONNECTIONSTATE.ERRORED, {
                        errorDescription: err.message,
                    })
                } else {
                    this.updateState(globals.CONNECTIONSTATE.ERRORED, {
                        errorDescription: errorMessage,
                    })
                }
            })
        }
    }
}

function getStateName(state: number) {
    switch (state) {
        case globals.CONNECTIONSTATE.CONNECTED:
            return "Connected"
        case globals.CONNECTIONSTATE.CONNECTING:
            return "Connecting"
        case globals.CONNECTIONSTATE.DISCONNECTED:
            return "Disconnected"
        case globals.CONNECTIONSTATE.ERRORED:
            return "Errored"
        case globals.CONNECTIONSTATE.FINISHING:
            return "Finishing"
        case globals.CONNECTIONSTATE.PREPARING:
            return "Preparing"
        case globals.CONNECTIONSTATE.PRINTING:
            return "Printing"
    }
}
