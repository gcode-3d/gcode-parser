import stateManager from "./stateManager.js"
import Device from "./classes/device.js"
import Setting from "./enums/setting.js"

const currentState = new stateManager()

// // Find initial printers on boot.
currentState.storage.getSettings().then((settings) => {
    if (
        settings.get(Setting.StartBoot) &&
        settings.get(Setting.SelectedDevice)
    ) {
        currentState.storage
            .getDeviceByName(settings.get(Setting.SelectedDevice) as string)
            .then((device) => {
                currentState.connectionManager
                    .create(
                        device.path,
                        isNaN(parseInt(device.baud))
                            ? null
                            : parseInt(device.baud)
                    )
                    .catch(console.error)
            })
            .catch(console.error)
    }
})
