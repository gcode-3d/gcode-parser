import StateManager from "../stateManager"

export default function cancelPrintAction(stateManager: StateManager) {
    stateManager.printManager.cancel()
}
