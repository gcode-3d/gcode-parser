const GLOBALS = require("../globals.js")
const SerialPort = require("serialport")
const globals = require("../globals.js")

class SerialConnectionManager {
    constructor(stateManager) {
        this.stateManager = stateManager
        this.config = {}
    }

    #create(path, baudrate) {
        new Promise(function (resolve, reject) {})
    }

    #getBaudrate(path) {
        return new Promise(
            function (resolve, reject) {
                try {
                    globals.BAUD.map((br) => () =>
                        this.#returnBaudratePromise(path, br)
                    ).reduce(
                        (promise, func) =>
                            promise.then((result) =>
                                func().then(Array.prototype.concat.bind(result))
                            ),
                        Promise.resolve([])
                    )
                } catch (e) {
                    reject(e)
                }
            }.bind(this)
        )
    }

    #returnBaudratePromise(path, baudRate) {
        console.log(`attempt: ${path} - ${baudRate}`)
        return new Promise(
            function (resolve) {
                try {
                    const connection = new SerialPort(path, {
                        baudRate,
                        autoOpen: false,
                    })
                    // const testString = makeString(50)
                    const testString = "G28"

                    connection.on("open", function () {
                        console.log("open")

                        connection.on("data", function (data) {
                            console.log("data")
                            console.log(data)
                        })
                        connection.on("drain", function (drain) {
                            console.log("drain")
                            console.log(drain)
                        })
                        connection.on("readable", function () {
                            console.log("data: ", connection.read())
                        })

                        setInterval(function () {
                            connection.write("N0 M110 N0*125")
                            console.log(connection.read())
                        }, 500)
                    })
                    connection.on("error", function (error) {
                        console.log("error")
                        console.log(error)
                    })
                    connection.open()
                } catch (e) {
                    console.error(e)
                }
            }.bind(this)
        )
    }

    create(path, baudrate) {
        return new Promise(
            function (resolve, reject) {
                if (!baudrate) {
                    this.#getBaudrate(path).then((baudrate) => {
                        this.#create(path, baudrate).then(resolve).catch(reject)
                    })
                } else {
                    this.#create(path, baudrate).then(resolve).catch(reject)
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
