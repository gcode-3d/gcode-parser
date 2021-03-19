import connectionUpdateAction from "../actions/stateUpdate"
import startPrintAction from "../actions/startPrint"
import StateManager from "../stateManager"
import UserTokenResult from "./UserTokenResult"

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
                default:
                    return Promise.reject(action + " action is not valid")
            }
        })
    }
}
