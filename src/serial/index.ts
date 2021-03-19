import SerialPort, { Stream } from "serialport"
import StateManager from "../stateManager"
import GLOBALS from "../globals.js"
import globals from "../globals.js"
import Readline from "@serialport/parser-readline"
import ExtSerialPort from "../interfaces/serialport"
import PrintInfo from "../classes/printInfo"
import { printDescription } from "../interfaces/stateInfo"
import CommandInfo from "../classes/CommandInfo"

export default class SerialConnectionManager {
    stateManager: StateManager
    lastCommand: { code: string | null; responses: string[] }
    connection: ExtSerialPort
    parser: Stream
    waitCallback?: () => void
    successCallback?: (result: parsedResponse) => void
    private isCreating: boolean = false
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
        this.connection.on("close", () => {
            this.stateManager.updateState(
                globals.CONNECTIONSTATE.DISCONNECTED,
                {
                    disconnectionInfo: {
                        time: new Date().getTime(),
                    },
                }
            )
        })
        return this.connection
    }
    send(message: string, callback?: (response: parsedResponse) => void) {
        if (callback == null) {
            const matches = message.match(/\n?(?:N\d )?(G\d+|M\d+)/)
            if (matches == null) {
                console.log("[Invalid gcode] " + message)
            }
            if (matches != null) {
                this.lastCommand.code = matches[1]
                this.lastCommand.responses.push(message)
            }
            this.connection.writeDrain("\n" + message + "\n")
            this.connection.writeDrain("\n")
        } else if (
            this.lastCommand.code != null &&
            this.lastCommand.responses.filter((i) =>
                i.trim().toLowerCase().startsWith("ok")
            ).length == 0
        ) {
            this.waitCallback = () => {
                this.send(message)
                this.successCallback = (result) => {
                    callback(result)
                }
            }
        } else {
            this.send(message)
            this.successCallback = (result) => {
                callback(result)
            }
        }
    }

    handleOpen() {
        this.connection.flush()
        this.stateManager.updateState(globals.CONNECTIONSTATE.CONNECTED, null)
        this.parser = this.connection.pipe(new Readline())

        this.parser.on("data", (data: string) => {
            if (
                data.trim().match(/\s+(ok\s+((P|B|N)\d+\s+)*)?(B|T\d*):\d+/) ==
                    null &&
                data.trim().match(/(echo:\s*)?busy:\s*processing/) == null
            ) {
                // console.log(data)
            }
            if (!this.stateManager.printer) {
                return
            }
            if (data.startsWith("ok") && this.lastCommand.code != null) {
                this.lastCommand.responses.push(data)
                let result = this.stateManager.parser.parseResponse(
                    this.lastCommand.code,
                    this.lastCommand.responses,
                    true
                )
                const responses = this.lastCommand.responses.join("\n") + data

                if (this.waitCallback != null) {
                    this.waitCallback()
                }
                if (this.successCallback != null) {
                    this.successCallback(result)
                }
                this.stateManager.webserver.sendMessageToClients(responses)
                this.lastCommand = {
                    code: null,
                    responses: [],
                }
            } else if (data.startsWith("ok")) {
                let code = "?"
                if (
                    this.stateManager.state ===
                        globals.CONNECTIONSTATE.PRINTING &&
                    this.stateManager.parser.parseLineNr(data) != null
                ) {
                    let lineNr = this.stateManager.parser.parseLineNr(data)
                    let commandInfo = this.stateManager.printManager.sentCommands.get(
                        lineNr
                    )
                    const matches = commandInfo.command.match(
                        /\n?(?:N\d )?(G\d+|M\d+)/
                    )
                    if (matches != null) {
                        code = matches[1]
                    }
                }

                if (this.waitCallback != null) {
                    this.waitCallback()
                }
                if (this.successCallback != null) {
                    let result = this.stateManager.parser.parseResponse(
                        code,
                        [data],
                        true
                    )
                    let linenr = this.stateManager.parser.parseLineNr(data)
                    let commandInfo = this.stateManager.printManager.sentCommands.get(
                        linenr
                    )
                    this.successCallback(result)
                }
                return this.stateManager.webserver.sendMessageToClients(data)
            } else if (data.startsWith("echo")) {
                console.log("[Echo] " + data)
            } else if (
                this.stateManager.printer.capabilities.has(
                    "Cap:AUTOREPORT_TEMP"
                ) &&
                this.stateManager.printer.capabilities.get(
                    "Cap:AUTOREPORT_TEMP"
                ) == true &&
                data.match(/T\d?:/i) != null
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
                        return resolve({
                            isWorking: false,
                            capabilities: null,
                        })
                    }
                    const capabilities = this.stateManager.parser.parseResponse(
                        "M115",
                        result.responses,
                        true
                    ) as Map<string, string | boolean>
                    this.stateManager.createPrinter(capabilities)

                    return resolve({
                        isWorking: true,
                        capabilities,
                    })
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
        if (this.isCreating) {
            return
        }
        this.isCreating = true
        return new Promise((resolve, reject) => {
            if (!baudrate) {
                this.getBaudrate(path).then((baudrate: boolean | number) => {
                    if (baudrate === false) {
                        return reject("No baudrate combination worked.")
                    }
                    this.isCreating = false
                    resolve(this.openConnection(path, baudrate as number))
                })
            } else {
                this.getCapabilities(path, baudrate)
                    .then(() => {
                        this.isCreating = false
                        resolve(this.openConnection(path, baudrate))
                    })
                    .catch((e) => {
                        this.isCreating = false
                        reject(e)
                    })
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
