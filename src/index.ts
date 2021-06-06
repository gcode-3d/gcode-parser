import * as Sentry from "@sentry/node"
import stateManager from "./classes/stateManager.js"
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
    Sentry.init({
        dsn: settings.get(Setting.sentryDSN) as string,
        environment: "SERVER_" + process.env.NODE_ENV,
    })
})
