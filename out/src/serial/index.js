"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const serialport_1 = __importDefault(require("serialport"));
const globals_js_1 = __importDefault(require("../globals.js"));
const globals_js_2 = __importDefault(require("../globals.js"));
const parser_readline_1 = __importDefault(require("@serialport/parser-readline"));
class SerialConnectionManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        // this.config = this.stateManager.storage.
        this.lastCommand = {
            code: null,
            responses: [],
        };
        this.connection = null;
    }
    openConnection(path, baudRate) {
        console.log("Opening connection");
        this.connection = new serialport_1.default(path, { baudRate });
        this.connection.writeDrain = (data, callback) => {
            const matches = data.match(/\n?(?:N\d )?(G\d+|M\d+)/);
            if (matches != null) {
                this.lastCommand.code = matches[1];
            }
            this.connection.write(data);
            this.connection.drain(callback);
        };
        this.connection.on("open", this.handleOpen.bind(this));
        this.connection.on("error", (e) => {
            console.error(e);
            this.stateManager.updateState(globals_js_2.default.CONNECTIONSTATE.ERRORED, {
                errorDescription: e.message,
            });
        });
        return this.connection;
    }
    send(message) {
        this.connection.writeDrain("\n" + message + "\n");
        this.connection.writeDrain("\n");
    }
    handleOpen() {
        this.connection.flush();
        this.stateManager.updateState(globals_js_2.default.CONNECTIONSTATE.CONNECTED, null);
        this.stateManager.webserver.registerHandler((message) => {
            if (this.stateManager.state == globals_js_1.default.CONNECTIONSTATE.CONNECTED) {
                this.send(message);
            }
        });
        this.parser = this.connection.pipe(new parser_readline_1.default());
        this.parser.on("data", (data) => {
            if (data.startsWith("ok ") && this.lastCommand.code != null) {
                this.stateManager.parser.parseResponse(this.lastCommand.code, this.lastCommand.responses, false);
                const responses = this.lastCommand.responses.join("\n") + data;
                this.stateManager.webserver.sendMessageToClients(responses);
                this.lastCommand.code = null;
                this.lastCommand.responses = [];
            }
            else if (data.startsWith("ok ")) {
                return this.stateManager.webserver.sendMessageToClients(data);
            }
            else if (this.stateManager.printer.capabilities.has("Cap:AUTOREPORT_TEMP") &&
                this.stateManager.printer.capabilities.get("Cap:AUTOREPORT_TEMP") == true) {
                this.stateManager.parser.parseResponse("M105", [data], false);
            }
            else if (this.lastCommand.code != null) {
                this.lastCommand.responses.push(data);
            }
        });
    }
    getBaudrate(path) {
        return new Promise(async (resolve) => {
            let resultBaudrate = 0;
            for (let baudrate of globals_js_1.default.BAUD.slice(0)) {
                if (resultBaudrate != 0) {
                    break;
                }
                const result = await this.returnBaudratePromise(path, baudrate);
                if (result.isWorking == true) {
                    resultBaudrate = baudrate;
                    const capabilities = this.stateManager.parser.parseResponse("M115", result.responses, true);
                    this.stateManager.createPrinter(capabilities);
                }
            }
            resolve(resultBaudrate == 0 ? false : resultBaudrate);
        });
    }
    testConnection(path, baudRate) {
        return new Promise((resolve, reject) => {
            const connection = new serialport_1.default(path, {
                baudRate,
                autoOpen: false,
            });
            const parser = connection.pipe(new parser_readline_1.default());
            connection.on("open", function () {
                connection.flush();
                connection.on("data", function (data) {
                    if (data.toString().trim().startsWith("FIRMWARE_NAME:")) {
                        resolve(true);
                    }
                });
                parser.on("data", (data) => {
                    // this.responses.push(data)
                });
                setTimeout(function () {
                    connection.write("\nM115\n", function () {
                        connection.drain();
                    });
                }, 500);
            });
            connection.on("error", function (error) {
                console.error(error);
                reject(error);
            });
            connection.open();
        });
    }
    returnBaudratePromise(path, baudRate) {
        console.log(`attempt: ${path} - ${baudRate}`);
        return new Promise(function (resolve) {
            let connection = new serialport_1.default(path, {
                baudRate,
                autoOpen: false,
            });
            let responses = [];
            try {
                var isWorking = false;
                var timeout;
                setTimeout(function () {
                    connection.close(() => {
                        resolve({
                            isWorking,
                            responses,
                        });
                    });
                }, 2000);
                const parser = connection.pipe(new parser_readline_1.default());
                connection.on("open", function () {
                    connection.flush();
                    connection.on("data", function (data) {
                        if (data
                            .toString()
                            .trim()
                            .startsWith("FIRMWARE_NAME:")) {
                            isWorking = true;
                        }
                    });
                    parser.on("data", function (data) {
                        responses.push(data);
                    });
                    timeout = setTimeout(function () {
                        connection.write("\nM115\n", function () {
                            connection.drain();
                        });
                    }, 500);
                });
                connection.on("error", function (error) {
                    console.error(error);
                    isWorking = false;
                });
                connection.open();
            }
            catch (e) {
                console.error(e);
                isWorking = false;
                clearTimeout(timeout);
                connection.close(() => {
                    resolve({ isWorking, responses: [] });
                });
            }
        }.bind(this));
    }
    create(path, baudrate) {
        return new Promise((resolve, reject) => {
            if (!baudrate) {
                this.getBaudrate(path).then((baudrate) => {
                    if (baudrate === false) {
                        return reject("No baudrate combination worked.");
                    }
                    resolve(this.openConnection(path, baudrate));
                });
            }
            else {
                resolve(this.openConnection(path, baudrate));
            }
        });
    }
    list() {
        return serialport_1.default.list();
    }
    reportError(error) {
        console.error(error);
    }
}
exports.default = SerialConnectionManager;
