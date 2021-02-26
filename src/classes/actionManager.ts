import StateManager from "../stateManager"

export default class ActionManager {
    stateManager: StateManager

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
    }

    execute(action: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            switch (action) {
                // case "file_insert":
                // handleFileInsert(string, data)
                case "file_update":
                    this.handleFileUpdate(data as fileUpdateActionData)
                        .then(resolve)
                        .catch(reject)
                    break
                case "file_delete":
                    this.handleFileDelete(data.name)
                default:
                    return Promise.reject(action + " action is not valid")
            }
        })
    }

    private handleFileUpdate(data: fileUpdateActionData): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!data.old_name || data.old_name.length == 0) {
                return reject("Old name is not specified")
            } else if (!data.new_name || data.new_name.length == 0) {
                return reject("New name is not specified")
            } else if (new TextEncoder().encode("foo").length > 250) {
                return reject("New name is too big")
            }

            this.stateManager.storage
                .updateFileName(data.old_name, data.new_name)
                .then(resolve)
                .catch(reject)
        })
    }
    private handleFileDelete(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!name || name.length == 0) {
                return reject("Name is not specified")
            }

            this.stateManager.storage
                .removeFileByName(name)
                .then(resolve)
                .catch(reject)
        })
    }
}
