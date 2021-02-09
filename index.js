const Serialmanager = require("./src/serial/")
const stateManager = require("./src/stateManager.js")

const currentState = new stateManager()

// // Find initial printers on boot.
currentState.storage.listDevices().then((devices) => {
    if (devices.length > 0) {
        currentState.connectionManager.create(
            devices[0].path,
            isNaN(devices[0].baud) ? null : parseInt(devices[0].baud)
        )
    }
})
