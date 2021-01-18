module.exports = class Printer {
    constructor(stateManager, profileSettings, capabilities) {
        this.stateManager = stateManager
        this.profileSettings = profileSettings
        this.capabilities = capabilities
        this.handlers = []
    }
    registerUpdateHandler(callback) {
        this.handlers.push(callback)
    }
    updateCapabilities(capabilities) {
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
