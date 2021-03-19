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
        })
    }
    sendPrintRow() {
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return console.log("state is incorrect")
        }
        if (this.currentPrint.getCurrentRow() > this.currentPrintFile.length) {
            console.log("Finished")
            this.sentCommands = new Map()
            return this.stateManager.updateState(
                globals.CONNECTIONSTATE.CONNECTED,
                null
            )
        }

        if (this.currentPrint.getCurrentRow() == 0) {
            let line = "M110 N0"
            console.log("Started print - Setting line to 0")
            this.stateManager.connectionManager.send(line, () => {
                this.currentPrint.nextRow()
                this.sendPrintRow()
            })
        } else {
            this.sendPreparedString(
                this.currentPrint.getCurrentRow(),
                this.currentPrintFile[this.currentPrint.getCurrentRow() - 1],
                (result: parsedResponse) => {
                    this.currentPrint.nextRow()
                    this.sendPrintRow()
                }
            )
        }
    }

    sendPreparedString(
        linenr: number,
        command: string,
        callback: (response: parsedResponse) => void
    ) {
        console.log(`[${linenr}] ${command}`)
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
                return line.trim().replace(/;.*$/, "").replace(" ", "")
            })
            .filter((line) => {
                return line.length > 0
            })
    }
}
