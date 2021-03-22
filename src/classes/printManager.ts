import globals from "../globals"
import StateManager from "../stateManager"
import CommandInfo from "./CommandInfo"
import File from "./file"
import PrintInfo from "./printInfo"

export default class PrintManager {
    stateManager: StateManager
    currentPrint: PrintInfo
    currentPrintFile: string[]
    sentCommands: Map<number, CommandInfo> = new Map()
    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
    }

    startPrint(fileName: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                let file = await this.stateManager.storage.getFileByName(
                    fileName
                )
                if (!file) {
                    throw (
                        "Creating new print: Specified file " +
                        fileName +
                        " does not exist."
                    )
                }
                this.currentPrint = new PrintInfo(file)
            } catch (e) {
                this.stateManager.throwError(e)
                return reject(e)
            }
            this.currentPrintFile = this.parseFile(this.currentPrint.file)

            this.stateManager.updateState(globals.CONNECTIONSTATE.PRINTING, {
                printInfo: {
                    file: new File(
                        this.currentPrint.file.name,
                        this.currentPrint.file.uploaded,
                        null
                    ),
                    progress: (
                        (this.currentPrint.getCurrentRow() /
                            this.currentPrintFile.length) *
                        100
                    ).toString(),
                    startTime: this.currentPrint.startTime,
                },
                tempData:
                    this.stateManager.printer != null
                        ? this.stateManager.printer.temperatureInfo
                        : [],
            })
            console.log(
                `${this.currentPrintFile.length} lines loaded, starting print ` +
                    this.currentPrint.file.name
            )
            this.sendPrintRow()
            resolve()
        })
    }
    sendPrintRow() {
        if (!this.currentPrint) {
            return
        }
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return this.clearLastPrint()
        }

        if (this.currentPrint.getCurrentRow() > this.currentPrintFile.length) {
            this.clearLastPrint()
            return this.stateManager.updateState(
                globals.CONNECTIONSTATE.CONNECTED,
                null
            )
        }

        if (this.currentPrint.getCurrentRow() == 0) {
            let line = "M110 N0"
            this.stateManager.connectionManager.send(line, () => {
                if (!this.currentPrint) {
                    return
                }
                this.currentPrint.nextRow()
                this.sendPrintRow()
            })
        } else {
            this.sendPreparedString(
                this.currentPrint.getCurrentRow(),
                this.currentPrintFile[this.currentPrint.getCurrentRow() - 1],
                (result: parsedResponse) => {
                    if (!this.currentPrint) {
                        return
                    }
                    this.currentPrint.nextRow()
                    this.sendPrintRow()
                }
            )
        }
    }

    private clearLastPrint() {
        this.sentCommands = new Map()
        this.currentPrint = null
        this.currentPrintFile = []
    }

    cancel() {
        if (this.stateManager.state === globals.CONNECTIONSTATE.PRINTING) {
            return this.stateManager.updateState(
                globals.CONNECTIONSTATE.CONNECTED,
                null
            )
        }
    }

    sendPreparedString(
        linenr: number,
        command: string,
        callback: (response: parsedResponse) => void
    ) {
        this.sentCommands.set(linenr, new CommandInfo(command))
        let preparedString = `N${linenr}${command}`
        preparedString +=
            "*" + this.stateManager.parser.calculateChecksum(preparedString)
        this.stateManager.connectionManager.send(preparedString, callback)
    }

    parseFile(file?: File): string[] {
        if (!file.data) {
            this.stateManager.throwError("File object has no data specified")
            return
        }
        let lines = file.data.toString("utf8").split(/\r?\n/)

        return lines
            .map((line) => {
                return line.trim().replace(/;.*$/, "").replace(/\s*/g, "")
            })
            .filter((line) => {
                return line.length > 0
            })
    }
}
