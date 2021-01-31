const Serialmanager = require("./src/serial/")
const stateManager = require("./src/stateManager.js")

const currentState = new stateManager()

// Find initial printers on boot.
currentState.connectionManager
    .list()
    .then((list) => {
        var printers = list.filter((i) => {
            return i["manufacturer"] == "wch.cn"
        })
        if (printers.length == 0) {
            return console.log("No printers found")
        }

        currentState.connectionManager.create(printers[0].path)
    })
    .catch((e) => {
        console.error(e)
    })
