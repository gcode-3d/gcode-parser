import SerialPort, { Stream } from "serialport"
import StateManager from "../stateManager"
import GLOBALS from "../globals.js"
import globals from "../globals.js"
import Readline from "@serialport/parser-readline"
import ExtSerialPort from "../interfaces/serialport"

export default class SerialConnectionManager {
    stateManager: StateManager
    lastCommand: { code: string | null; responses: string[] }
    connection: ExtSerialPort
    parser: Stream
    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
        // this.config = this.stateManager.storage.
        this.lastCommand = {
            code: null,
            responses: [],
        }
        this.connection = null
    }

    openConnection(path: string, baudRate: number) {
        this.connection = new SerialPort(path, { baudRate }) as ExtSerialPort
        this.connection.writeDrain = (data, callback) => {
            const matches = data.match(/\n?(?:N\d )?(G\d+|M\d+)/)
            if (matches != null) {
                this.lastCommand.code = matches[1]
            }
            this.connection.write(data)
            this.connection.drain(callback)
        }
        this.connection.on("open", this.handleOpen.bind(this))
        this.connection.on("error", (e) => {
            console.error(e)

            this.stateManager.updateState(globals.CONNECTIONSTATE.ERRORED, {
                errorDescription: e.message,
            })
        })
        return this.connection
    }
    send(message: string) {
        this.connection.writeDrain("\n" + message + "\n")
        this.connection.writeDrain("\n")
    }

    handleOpen() {
        this.connection.flush()
        this.stateManager.updateState(globals.CONNECTIONSTATE.CONNECTED, null)
        this.parser = this.connection.pipe(new Readline())

        this.parser.on("data", (data: string) => {
            if (data.startsWith("ok ") && this.lastCommand.code != null) {
                this.stateManager.parser.parseResponse(
                    this.lastCommand.code,
                    this.lastCommand.responses,
                    false
                )
                const responses = this.lastCommand.responses.join("\n") + data
                this.stateManager.webserver.sendMessageToClients(responses)

                this.lastCommand.code = null
                this.lastCommand.responses = []
            } else if (data.startsWith("ok ")) {
                return this.stateManager.webserver.sendMessageToClients(data)
            } else if (
                this.stateManager.printer.capabilities.has(
                    "Cap:AUTOREPORT_TEMP"
                ) &&
                this.stateManager.printer.capabilities.get(
                    "Cap:AUTOREPORT_TEMP"
                ) == true
            ) {
                this.stateManager.parser.parseResponse("M105", [data], false)
            } else if (this.lastCommand.code != null) {
                this.lastCommand.responses.push(data)
            }
        })
    }

    getCapabilities(
        path: string,
        baudrate: number
    ): Promise<capabilitiesResponse> {
        return new Promise((resolve, reject) => {
            this.returnBaudratePromise(path, baudrate)
                .then((result) => {
                    if (result.isWorking == false) {
                        return { isWorking: false }
                    }
                    const capabilities = this.stateManager.parser.parseResponse(
                        "M115",
                        result.responses,
                        true
                    )
                    this.stateManager.createPrinter(
                        capabilities as Map<string, string | boolean>
                    )
                    return {
                        isWorking: true,
                        capabilities,
                    }
                })
                .catch(reject)
        })
    }

    getBaudrate(path: string): Promise<boolean | number> {
        return new Promise(async (resolve) => {
            let resultBaudrate = 0
            for (let baudrate of GLOBALS.BAUD.slice(0)) {
                if (resultBaudrate != 0) {
                    break
                }

                const result = await this.getCapabilities(path, baudrate)
                if (result.isWorking == true) {
                    resultBaudrate = baudrate
                }
            }
            resolve(resultBaudrate == 0 ? false : resultBaudrate)
        })
    }

    testConnection(path: string, baudRate: number) {
        return new Promise((resolve, reject) => {
            const connection = new SerialPort(path, {
                baudRate,
                autoOpen: false,
            })
            const parser = connection.pipe(new Readline())
            connection.on("open", function () {
                connection.flush()

                connection.on("data", function (data) {
                    if (data.toString().trim().startsWith("FIRMWARE_NAME:")) {
                        resolve(true)
                    }
                })
                parser.on("data", (data: string) => {
                    // this.responses.push(data)
                })

                setTimeout(function () {
                    connection.write("\nM115\n", function () {
                        connection.drain()
                    })
                }, 500)
            })
            connection.on("error", function (error) {
                console.error(error)
                reject(error)
            })
            connection.open()
        })
    }

    returnBaudratePromise(
        path: string,
        baudRate: number
    ): Promise<baudRateResponses> {
        return new Promise(
            function (resolve: (arg0: baudRateResponses) => void) {
                let connection = new SerialPort(path, {
                    baudRate,
                    autoOpen: false,
                })
                let responses: string[] = []

                try {
                    var isWorking = false
                    var timeout: NodeJS.Timeout

                    setTimeout(function () {
                        connection.close(() => {
                            resolve({
                                isWorking,
                                responses,
                            })
                        })
                    }, 2000)

                    const parser = connection.pipe(new Readline())
                    connection.on("open", function () {
                        connection.flush()

                        connection.on("data", function (data) {
                            if (
                                data
                                    .toString()
                                    .trim()
                                    .startsWith("FIRMWARE_NAME:")
                            ) {
                                isWorking = true
                            }
                        })
                        parser.on("data", function (data: string) {
                            responses.push(data)
                        })

                        timeout = setTimeout(function () {
                            connection.write("\nM115\n", function () {
                                connection.drain()
                            })
                        }, 500)
                    })
                    connection.on("error", function (error) {
                        console.error(error)
                        isWorking = false
                    })
                    connection.open()
                } catch (e) {
                    console.error(e)
                    isWorking = false
                    clearTimeout(timeout)
                    connection.close(() => {
                        resolve({ isWorking, responses: [] })
                    })
                }
            }.bind(this)
        )
    }

    create(path: string, baudrate: number) {
        return new Promise((resolve, reject) => {
            if (!baudrate) {
                this.getBaudrate(path).then((baudrate: boolean | number) => {
                    if (baudrate === false) {
                        return reject("No baudrate combination worked.")
                    }
                    resolve(this.openConnection(path, baudrate as number))
                })
            } else {
                this.getCapabilities(path, baudrate)
                    .then(() => {
                        resolve(this.openConnection(path, baudrate))
                    })
                    .catch(reject)
            }
        })
    }

    list() {
        return SerialPort.list()
    }

    reportError(error: Error) {
        console.error(error)
    }
}
