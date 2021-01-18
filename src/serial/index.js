const GLOBALS = require("../globals.js")
const SerialPort = require("serialport")
const globals = require("../globals.js")
const Readline = require("@serialport/parser-readline")
class SerialConnectionManager {
    constructor(stateManager) {
        this.stateManager = stateManager
        this.config = {}
        this.lastCommand = {
            code: null,
            responses: [],
        }
    }

    openConnection(path, baudRate) {
        console.log("Opening connection")
        this.connection = new SerialPort(path, { baudRate })
        this.connection.writeDrain = function (data, callback) {
            const matches = data.match(/\n?(?:N\d )?(G\d+|M\d+)/)
            if (matches != null) {
                this.lastCommand.code = matches[1]
            }
            this.connection.write(data)
            this.connection.drain(callback)
        }.bind(this)
        this.connection.on("open", this.handleOpen.bind(this))
        this.connection.on(
            "error",
            function (e) {
                this.stateManager.updateState(globals.CONNECTIONSTATE.ERRORED, {
                    errorInfo: "Connectection errored, \n" + e,
                })
                this.connection.close()
            }.bind(this)
        )
    }
    send(message) {
        this.connection.writeDrain("\n" + message + "\n")
        this.connection.writeDrain("\n")
    }

    handleOpen() {
        this.connection.flush()
        this.stateManager.updateState(globals.CONNECTIONSTATE.CONNECTED)
        this.stateManager.webserver.registerHandler(
            function (message) {
                if (
                    this.stateManager.state == GLOBALS.CONNECTIONSTATE.CONNECTED
                ) {
                    this.send(message)
                }
            }.bind(this)
        )

        this.parser = this.connection.pipe(new Readline())

        this.parser.on(
            "data",
            function (data) {
                if (data.startsWith("ok ") && this.lastCommand.code != null) {
                    this.stateManager.parser.parseResponse(
                        this.lastCommand.code,
                        this.lastCommand.responses
                    )
                    const responses =
                        this.lastCommand.responses.join("\n") + data
                    this.stateManager.webserver.sendMessageToClients(responses)

                    this.lastCommand.code = null
                    this.lastCommand.responses = []
                } else if (data.startsWith("ok ")) {
                    return this.stateManager.webserver.sendMessageToClients(
                        data
                    )
                } else if (
                    this.stateManager.printer.capabilities.has(
                        "Cap:AUTOREPORT_TEMP"
                    ) &&
                    this.stateManager.printer.capabilities.get(
                        "Cap:AUTOREPORT_TEMP"
                    ) == true
                ) {
                    this.stateManager.parser.parseResponse(
                        "M105",
                        [data],
                        false
                    )
                } else if (this.lastCommand.code != null) {
                    this.lastCommand.responses.push(data)
                }
            }.bind(this)
        )
    }

    getBaudrate(path) {
        return new Promise(
            async function (resolve) {
                let resultBaudrate = 0
                for (let baudrate of GLOBALS.BAUD.slice(0)) {
                    if (resultBaudrate != 0) {
                        break
                    }
                    const result = await this.returnBaudratePromise(
                        path,
                        baudrate
                    )
                    if (result.isWorking == true) {
                        resultBaudrate = baudrate
                        const capabilities = this.stateManager.parser.parseResponse(
                            "M115",
                            result.responses,
                            true
                        )
                        this.stateManager.createPrinter(capabilities)
                    }
                }
                resolve(resultBaudrate == 0 ? false : resultBaudrate)
            }.bind(this)
        )
    }

    returnBaudratePromise(path, baudRate) {
        console.log(`attempt: ${path} - ${baudRate}`)
        return new Promise(
            function (resolve) {
                try {
                    let isWorking = false
                    const responses = []
                    setTimeout(function () {
                        connection.close(() => {
                            resolve({
                                isWorking,
                                responses,
                            })
                        })
                    }, 2000)
                    const connection = new SerialPort(path, {
                        baudRate,
                        autoOpen: false,
                    })
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
                        parser.on("data", function (data) {
                            responses.push(data)
                        })

                        setTimeout(function () {
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
                        resolve(isWorking)
                    })
                }
            }.bind(this)
        )
    }

    create(path, baudrate) {
        return new Promise(
            function (resolve, reject) {
                if (!baudrate) {
                    this.getBaudrate(path).then((baudrate) => {
                        if (baudrate === false) {
                            return reject("No baudrate combination worked.")
                        }
                        resolve(this.openConnection(path, baudrate))
                    })
                } else {
                    resolve(this.openConnection(path, baudrate))
                }
            }.bind(this)
        )
    }

    list() {
        return SerialPort.list()
    }

    reportError(error) {
        console.error(error)
    }
}

module.exports = SerialConnectionManager

function makeString(length) {
    var result = ""
    var characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    var charactersLength = characters.length
    for (var i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        )
    }
    return result
}
