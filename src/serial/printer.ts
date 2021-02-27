import StateManager from "../stateManager"

export default class Printer {
    stateManager: StateManager
    capabilities: Map<string, boolean | string>
    handlers: any[]
    constructor(
        stateManager: StateManager,
        capabilities: Map<string, boolean | string>
    ) {
        this.stateManager = stateManager
        this.capabilities = capabilities
        this.handlers = []
    }
    registerUpdateHandler(callback: () => void) {
        this.handlers.push(callback)
    }
    updateCapabilities(capabilities: Map<string, boolean | string>) {
        // if (
        //     (capabilities.has("Cap:AUTOREPORT_TEMP") &&
        //     capabilities.get("Cap:AUTOREPORT_TEMP") == false) && this
        // ) {
        // 	if (this.loops.tempReport == null)
        //     this.loops.tempReport = setInterval(this.reportTemp(), 1000)
        // } else if (
        //     capabilities.has("Cap:AUTOREPORT_TEMP") &&
        //     capabilities.get("Cap:AUTOREPORT_TEMP") == true
        // ) {
        // 	//
        // } else if (this.loops.tempReport != null) {
        // 	this.
        // } else {
        //     this.loops.tempReport = setInterval(this.reportTemp(), 1000)
        // }
    }
    reportTemp() {
        this.stateManager.connectionManager.send("M105")
    }
}