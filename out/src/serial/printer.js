"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Printer {
    constructor(stateManager, capabilities) {
        this.stateManager = stateManager;
        this.capabilities = capabilities;
        this.handlers = [];
    }
    registerUpdateHandler(callback) {
        this.handlers.push(callback);
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
        this.stateManager.connectionManager.send("M105");
    }
}
exports.default = Printer;
