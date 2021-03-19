import globals from "../globals"
import StateManager from "../stateManager"

export default function terminalSendAction(
    stateManager: StateManager,
    command: string
) {
    if (stateManager.state === globals.CONNECTIONSTATE.CONNECTED) {
        stateManager.connectionManager.send(command)
    }
}
