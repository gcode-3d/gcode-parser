import stateManager from "./stateManager.js"
import Device from "./classes/device.js"

const currentState = new stateManager()

// // Find initial printers on boot.
currentState.storage.listDevices().then((devices: Device[]) => {
    if (devices.length > 0) {
        currentState.connectionManager
            .create(
                devices[0].path,
                isNaN(parseInt(devices[0].baud))
                    ? null
                    : parseInt(devices[0].baud)
            )
            .catch(console.error)
    }
})
