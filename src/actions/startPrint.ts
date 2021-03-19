import StateManager from "../stateManager"

export default function startPrintAction(
    stateManager: StateManager,
    fileName: string
) {
    stateManager.printManager.startPrint(fileName)
}
