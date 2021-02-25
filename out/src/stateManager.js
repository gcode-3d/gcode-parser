"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parser_js_1 = __importDefault(require("./parser.js"));
const webserver_js_1 = __importDefault(require("./webserver.js"));
const globals_js_1 = __importDefault(require("./globals.js"));
const printer_js_1 = __importDefault(require("./serial/printer.js"));
const storage_js_1 = __importDefault(require("./storage.js"));
const index_js_1 = __importDefault(require("./serial/index.js"));
const config = __importStar(require("../config.json"));
class StateManager {
    constructor() {
        this.state = globals_js_1.default.CONNECTIONSTATE.DISCONNECTED;
        this.config = config;
        this.printer = null;
        this.storage = new storage_js_1.default();
        this.connectionManager = new index_js_1.default(this);
        this.parser = new parser_js_1.default(this);
        this.webserver = new webserver_js_1.default(this);
        this.additionalStateInfo = {};
    }
    createPrinter(capabilities) {
        this.printer = new printer_js_1.default(this, capabilities);
        this.printer.updateCapabilities(capabilities);
    }
    getCurrentStateInfo() {
        switch (this.state) {
            case globals_js_1.default.CONNECTIONSTATE.DISCONNECTED:
                return {
                    state: "Disconnected",
                };
            case globals_js_1.default.CONNECTIONSTATE.CONNECTED:
                return {
                    state: "Connected",
                    print: null,
                };
            case globals_js_1.default.CONNECTIONSTATE.CONNECTING:
                return {
                    state: "Connecting",
                };
            case globals_js_1.default.CONNECTIONSTATE.ERRORED:
                return {
                    state: "Errored",
                    description: this.additionalStateInfo.errorDescription,
                };
            case globals_js_1.default.CONNECTIONSTATE.PREPARING:
                return {
                    state: "Preparing print",
                };
            case globals_js_1.default.CONNECTIONSTATE.PRINTING:
                return {
                    state: "Printing",
                    description: this.additionalStateInfo.printInfo
                        ? this.additionalStateInfo.printInfo
                        : null,
                };
            case globals_js_1.default.CONNECTIONSTATE.FINISHING:
                return {
                    state: "Finishing",
                };
        }
    }
    updateState(state, extraDescription) {
        this.state = state;
        this.additionalStateInfo = extraDescription;
        this.webserver.wss.clients.forEach((socket) => {
            socket.sendJSON({
                type: "state_update",
                content: state,
                description: extraDescription || null,
            });
        });
    }
}
exports.default = StateManager;
