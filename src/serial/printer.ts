import StateManager from "../classes/stateManager"

export default class Printer {
    stateManager: StateManager
    capabilities: Map<string, boolean | string>
    handlers: any[]
    temperatureInfo: tempInfo[]
    constructor(
        stateManager: StateManager,
        capabilities: Map<string, boolean | string>
    ) {
        this.stateManager = stateManager
        this.capabilities = capabilities
        this.handlers = []
        this.temperatureInfo = []
    }
    registerUpdateHandler(callback: () => void) {
        this.handlers.push(callback)
    }
    setTemperatureInfo(data: tempInfo) {
        this.temperatureInfo.push(data)
        if (this.temperatureInfo.length > 50) {
            this.temperatureInfo.shift()
        }
    }
    async manageCapabilityValues() {
        if (!this.capabilities) {
            return Promise.reject("Cannot parse capabilities from this device")
        }
        let capabilities = Array.from(this.capabilities)
        return new Promise<void>(async (resolve, reject) => {
            try {
                for (let i = 0; i < capabilities.length; i++) {
                    let key = capabilities[i][0]
                    let value = capabilities[i][1]
                    await new Promise<void>((resolve, reject) => {
                        switch (key) {
                            case "FIRMWARE_NAME":
                                if (
                                    !(
                                        this.capabilities.get(
                                            "FIRMWARE_NAME"
                                        ) as string
                                    )
                                        .toLowerCase()
                                        .includes("marlin")
                                ) {
                                    console.warn(
                                        "[WARN] Printer doesn't indicate to be using Marlin. This software is build only for Marlin. Use at own risk."
                                    )
                                }
                                break
                            case "Cap:AUTOREPORT_TEMP":
                                if (value == true) {
                                    return this.stateManager.connectionManager.send(
                                        "M155S2",
                                        (response) => {
                                            if (response === true) {
                                                resolve()
                                            } else {
                                                reject(
                                                    "[ERROR][CAPABILITIES] Setting up AUTOREPORT_TEMP CAP returned the following unexpected code: " +
                                                        response
                                                )
                                            }
                                        }
                                    )
                                }
                        }
                        return resolve()
                    })
                }
                return resolve()
            } catch (e) {
                reject(e)
            }
        })
    }
    updateCapabilities(capabilities: Map<string, boolean | string>) {
        this.capabilities = capabilities
    }
    reportTemp() {
        this.stateManager.connectionManager.send("M105")
    }
}
