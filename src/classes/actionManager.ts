import connectionUpdateAction from "../actions/stateUpdate"
import startPrintAction from "../actions/startPrint"
import StateManager from "../stateManager"
import UserTokenResult from "./UserTokenResult"
import terminalSendAction from "../actions/terminalSendAction"
import cancelPrintAction from "../actions/cancelPrint"

export default class ActionManager {
    stateManager: StateManager

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
    }

    execute(
        userInfo: UserTokenResult,
        action: string,
        data: any
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let permissions = userInfo.permissions.serialize()
            switch (action) {
                case "connection_update":
                    if (
                        !userInfo.permissions.hasPermission("connection.edit")
                    ) {
                        return this.stateManager.connectionManager.send(
                            JSON.stringify({
                                error: "Unauthorized",
                            })
                        )
                    }
                    connectionUpdateAction(
                        this.stateManager.connectionManager,
                        data.new_state
                    )
                    break
                case "terminal_send":
                    if (!userInfo.permissions.hasPermission("terminal.send")) {
                        return this.stateManager.connectionManager.send(
                            JSON.stringify({
                                error: "Unauthorized",
                            })
                        )
                    }
                    terminalSendAction(this.stateManager, data.command)
                    break
                case "print_create":
                    if (
                        !userInfo.permissions.hasPermission("print_state.edit")
                    ) {
                        return this.stateManager.connectionManager.send(
                            JSON.stringify({
                                error: "Unauthorized",
                            })
                        )
                    }
                    startPrintAction(this.stateManager, data.name)
                    break
                case "print_cancel":
                    if (
                        !userInfo.permissions.hasPermission("print_state.edit")
                    ) {
                        return this.stateManager.connectionManager.send(
                            JSON.stringify({
                                error: "Unauthorized",
                            })
                        )
                    }
                    cancelPrintAction(this.stateManager)
                    break
                default:
                    return Promise.reject(action + " action is not valid")
            }
        })
    }
}
