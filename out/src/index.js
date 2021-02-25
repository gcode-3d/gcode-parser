"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stateManager_js_1 = __importDefault(require("./stateManager.js"));
const currentState = new stateManager_js_1.default();
// // Find initial printers on boot.
currentState.storage.listDevices().then((devices) => {
    if (devices.length > 0) {
        currentState.connectionManager.create(devices[0].path, isNaN(parseInt(devices[0].baud)) ? null : parseInt(devices[0].baud));
    }
});
