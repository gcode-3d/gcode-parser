import SerialPort, { Stream } from "serialport"
import StateManager from "../stateManager"
import GLOBALS from "../globals.js"
import globals from "../globals.js"
import Readline from "@serialport/parser-readline"
import ExtSerialPort from "../interfaces/serialport"
import PrintInfo from "../classes/printInfo"
import { printDescription } from "../interfaces/stateInfo"
import CommandInfo from "../classes/CommandInfo"
import LogPriority from "../enums/logPriority"

export default class SerialConnectionManager {
    stateManager: StateManager
    lastCommand: {
        code: string | null
        responses: string[]
        callback?: (result: parsedResponse) => void
    }
    connection: ExtSerialPort
    parser: Stream
    queue: { message: string; callback?: (result: parsedResponse) => void }[]
    private sentCommandsWithLineNr: Map<number, string> = new Map()
    private isCreating: boolean = false
    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
        // this.config = this.stateManager.storage.
        this.lastCommand = {
            code: null,
            responses: [],
        }
        this.queue = []
        this.connection = null
    }

    openConnection(
        path: string,
        connectionInfo: connectionInfo,
        resultCallback: (err?: Error) => void
    ) {
        let hasOpened = false
        this.connection = new SerialPort(path, {
            baudRate: connectionInfo.baudRate,
        }) as ExtSerialPort
        this.connection.writeDrain = (data, callback) => {
            this.connection.write(data)
            this.connection.drain(callback)
        }
        this.connection.on("open", () => {
            this.handleOpen(connectionInfo.capabilities)
            resultCallback(null)
            hasOpened = true
        })
        this.connection.on("error", (e) => {
            console.error(e)
            if (!hasOpened) {
                resultCallback(e)
            }

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
        if (this.lastCommand.code == null) {
            const matches = message.match(/\n?(N\d ?)?(G\d+|M\d+)/)
            if (matches == null) {
                console.log("[Invalid gcode] " + message)
            }
            if (matches != null) {
                this.lastCommand.code = matches[2]
                this.lastCommand.callback = callback
            }
            this.stateManager.webserver.sendMessageToClients(
                message,
                globals.TERMINALLINETYPES.INPUT
            )
            if (matches[1] != null) {
                this.sentCommandsWithLineNr.set(
                    parseInt(matches[1].slice(1)),
                    message
                )
            }

            this.connection.writeDrain("\n" + message + "\n")
            this.connection.writeDrain("\n")
        } else {
            // still waiting on a callback or entries before
            this.queue.push({ message, callback })
        }
    }

    async handleOpen(capabilities: Map<string, string | boolean>) {
        this.connection.flush()

        this.parser = this.connection.pipe(new Readline())

        this.parser.on("data", async (data: string) => {
            if (
                data.trim().match(/\s+(ok\s+((P|B|N)\d+\s+)*)?(B|T\d*):\d+/) ==
                    null &&
                data.trim().match(/(echo:\s*)?busy:\s*processing/) == null
            ) {
                // console.log(data)
            }
            if (
                !this.stateManager.printer ||
                !this.stateManager.printer.capabilities
            ) {
                return
            }
            if (data.startsWith("Error")) {
                return console.error(data)
            }
            if (data.toLowerCase().startsWith("resend: ")) {
                let resendCode = parseInt(data.match(/Resend: (\d+)/i)[1])
                if (this.sentCommandsWithLineNr.has(resendCode)) {
                    let callback = null
                    if (this.lastCommand.callback != null) {
                        callback = this.lastCommand.callback
                    }
                    this.send(
                        this.sentCommandsWithLineNr.get(resendCode),
                        this.lastCommand.callback
                    )
                } else {
                    await this.stateManager.storage.log(
                        LogPriority.Warning,
                        "RESEND_WARN",
                        "Line number expected which isn't stored. Expected lineNr: " +
                            resendCode
                    )
                    console.warn(
                        "Line number expected which isn't stored. Expected lineNr: " +
                            resendCode
                    )
                }
                return
            }
            if (data.startsWith("ok") && this.lastCommand.code != null) {
                this.lastCommand.responses.push(data)
                let result = this.stateManager.parser.parseResponse(
                    this.lastCommand.code,
                    this.lastCommand.responses,
                    true
                )
                const responses = this.lastCommand.responses.join("\n")
                if (this.lastCommand.callback != null) {
                    this.lastCommand.callback(result)
                }

                this.lastCommand = {
                    code: null,
                    responses: [],
                    callback: null,
                }
                this.stateManager.webserver.sendMessageToClients(
                    responses,
                    globals.TERMINALLINETYPES.OUTPUT
                )
                if (this.queue.length > 0) {
                    let entry = this.queue.shift()
                    this.send(entry.message, (response) => {
                        let lineNrMatch = entry.message.match(/(N\d+)/i)
                        if (lineNrMatch != null) {
                            if (
                                this.sentCommandsWithLineNr.has(
                                    parseInt(lineNrMatch[1].slice(1))
                                )
                            ) {
                                this.sentCommandsWithLineNr.delete(
                                    parseInt(lineNrMatch[1].slice(1))
                                )
                            }
                        }

                        entry.callback(response)
                    })
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

                const responses = this.lastCommand.responses.join("\n")

                if (this.lastCommand.callback != null) {
                    let result = this.stateManager.parser.parseResponse(
                        code,
                        [data],
                        true
                    )
                    let linenr = this.stateManager.parser.parseLineNr(data)
                    let commandInfo = this.stateManager.printManager.sentCommands.get(
                        linenr
                    )
                    this.lastCommand.callback(result)
                }
                this.lastCommand = {
                    code: null,
                    responses: [],
                }
                if (this.queue.length > 0) {
                    let entry = this.queue.shift()
                    this.send(entry.message, (response) => {
                        let lineNrMatch = entry.message.match(/(N\d+)/i)
                        if (lineNrMatch != null) {
                            if (
                                this.sentCommandsWithLineNr.has(
                                    parseInt(lineNrMatch[1].slice(1))
                                )
                            ) {
                                this.sentCommandsWithLineNr.delete(
                                    parseInt(lineNrMatch[1].slice(1))
                                )
                            }
                        }

                        entry.callback(response)
                    })
                }
                return this.stateManager.webserver.sendMessageToClients(
                    data,
                    globals.TERMINALLINETYPES.OUTPUT
                )
            } else if (data.startsWith("echo")) {
                return this.stateManager.webserver.sendMessageToClients(
                    data,
                    globals.TERMINALLINETYPES.OUTPUT
                )
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
        try {
            this.stateManager.updateState(
                globals.CONNECTIONSTATE.CONNECTING,
                null
            )
            await this.stateManager.createPrinter(capabilities)
            this.stateManager.updateState(
                globals.CONNECTIONSTATE.CONNECTED,
                null
            )
            this.send("G90", (result) => {
                if (result == true) {
                    this.stateManager.updateState(
                        globals.CONNECTIONSTATE.CONNECTED,
                        null
                    )
                } else {
                    this.connection.close()
                    this.stateManager.updateState(
                        globals.CONNECTIONSTATE.ERRORED,
                        {
                            errorDescription:
                                "Error occurred while setting printer to absolute mode.",
                        }
                    )
                }
            })
        } catch (e) {
            console.error(e)
            this.connection.close()
            this.stateManager.updateState(globals.CONNECTIONSTATE.ERRORED, {
                errorDescription: e,
            })
            return
        }
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
                    return resolve({
                        isWorking: true,
                        capabilities,
                    })
                })
                .catch(reject)
        })
    }

    getBaudrate(path: string): Promise<boolean | connectionInfo> {
        return new Promise(async (resolve) => {
            let resultBaudrate = 0
            let capabilities
            for (let baudrate of GLOBALS.BAUD.slice(0)) {
                if (resultBaudrate != 0) {
                    break
                }

                const result = await this.getCapabilities(path, baudrate)
                if (result.isWorking == true) {
                    resultBaudrate = baudrate
                    capabilities = result.capabilities
                }
            }
            resolve(
                resultBaudrate == 0
                    ? false
                    : {
                          baudRate: resultBaudrate,
                          capabilities,
                      }
            )
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
                try {
                    connection.close()
                } catch (e) {}
                reject(error)
            })
            connection.open()
        })
    }

    returnBaudratePromise(
        path: string,
        baudRate: number
    ): Promise<baudRateResponses> {
        return new Promise((resolve: (arg0: baudRateResponses) => void) => {
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
                connection.on("open", () => {
                    connection.flush()

                    connection.on("data", function (data) {
                        if (
                            data.toString().trim().startsWith("FIRMWARE_NAME:")
                        ) {
                            isWorking = true
                        }
                    })
                    parser.on("data", function (data: string) {
                        // Remove lines that are auto-reported temperatures.
                        if (data.trim().match(/^T\d?:\d+\.\d+/i) == null) {
                            responses.push(data)
                        }
                    })

                    timeout = setTimeout(async () => {
                        await this.writeDrainConnectionAsync(
                            connection,
                            "\nM115\n"
                        )
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
        })
    }
    private writeDrainConnectionAsync(
        connection: SerialPort,
        data: string
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            connection.write(data, (err) => {
                if (err) {
                    return reject(err)
                }
                connection.drain((err) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve()
                })
            })
        })
    }

    create(path: string, baudrate: number) {
        if (this.isCreating) {
            return Promise.reject("Already creating an instance")
        }
        this.isCreating = true
        return new Promise<void>((resolve, reject) => {
            if (!baudrate) {
                this.getBaudrate(path).then((connectionInfo) => {
                    if (connectionInfo === false) {
                        return reject("No baudrate combination worked.")
                    }
                    connectionInfo = connectionInfo as connectionInfo
                    this.isCreating = false
                    this.openConnection(path, connectionInfo, (err) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve()
                        }
                    })
                })
            } else {
                this.getCapabilities(path, baudrate)
                    .then((capabilitiesResponse) => {
                        let connectionInfo: connectionInfo = {
                            baudRate: baudrate,
                            capabilities: capabilitiesResponse.capabilities,
                        }
                        this.isCreating = false
                        this.openConnection(
                            path,
                            connectionInfo,
                            (err: Error) => {
                                if (err) {
                                    reject(err)
                                } else {
                                    resolve()
                                }
                            }
                        )
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
