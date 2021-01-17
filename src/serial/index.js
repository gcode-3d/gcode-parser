const GLOBALS = require("../globals.js")
const SerialPort = require("serialport")
const globals = require("../globals.js")

class SerialConnectionManager {
    constructor(stateManager) {
        this.stateManager = stateManager
        this.config = {}
    }

    openConnection(path, baudRate) {
        console.log("Opening connection")
        this.connection = new SerialPort(path, { baudRate })
        this.connection.writeDrain = function (data, callback) {
            this.connection.write(data)
            this.connection.drain(callback)
        }.bind(this)
        this.connection.on("open", this.handleOpen.bind(this))
        this.connection.on("error", function () {}.bind(this))
    }

    handleOpen() {
        this.connection.flush()
        this.stateManager.webserver.registerHandler(
            function (message) {
                console.log("message", message)
                if (this.connection.isOpen) {
                    this.connection.writeDrain("\n" + message + "\n")
                    this.connection.writeDrain("\n")
                }
            }.bind(this)
        )
        this.connection.on(
            "data",
            function (data) {
                let string = data.toString().trim()
                this.stateManager.webserver.sendToClients(string)
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
                    if (result == true) {
                        resultBaudrate = baudrate
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
                    let timeout = setTimeout(function () {
                        connection.close(() => {
                            resolve(isWorking)
                        })
                    }, 4000)
                    const connection = new SerialPort(path, {
                        baudRate,
                        autoOpen: false,
                    })

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
                                clearTimeout(timeout)
                                connection.close(() => {
                                    resolve(isWorking)
                                })
                            }
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

    autoDetect() {
        if (this.global.state != GLOBALS)
            SerialPort.list()
                .then((results) => {
                    if (results) {
                    }
                })
                .catch(this.reportError)
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
