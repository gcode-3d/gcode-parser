import stateManager from "./stateManager.js"
import Setting from "./enums/setting.js"

const currentState = new stateManager()

// // Find initial printers on boot.
currentState.storage.getSettings().then((settings) => {
    if (settings.get(Setting.StartBoot) && settings.get(Setting.DevicePath)) {
        let baud = settings.get(Setting.DeviceBaud) as number
        currentState.connectionManager
            .create(settings.get(Setting.DevicePath) as string, baud)
            .catch(console.error)
    }
})
