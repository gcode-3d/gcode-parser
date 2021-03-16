import globals from "../globals"
import SerialConnectionManager from "../serial"

export default function connectionUpdateAction(
    connectionManager: SerialConnectionManager,
    new_state: String
) {
    switch (new_state) {
        case "reconnect":
            if (
                connectionManager.stateManager.state !=
                globals.CONNECTIONSTATE.CONNECTED
            ) {
                return
            }
            connectionManager.connection.close((err) => {
                if (err) {
                    return console.error(err)
                }

                connectionManager
                    .create(
                        connectionManager.connection.path,
                        connectionManager.connection.baudRate
                    )
                    .catch(console.error)
            })
            break
        case "disconnect":
            if (
                connectionManager.stateManager.state !=
                globals.CONNECTIONSTATE.CONNECTED
            ) {
                return
            }
            connectionManager.connection.close((err) => {
                if (err) {
                    return console.error(err)
                }
            })
            break
        case "connect":
            if (
                connectionManager.stateManager.state ===
                    globals.CONNECTIONSTATE.DISCONNECTED ||
                connectionManager.stateManager.state ===
                    globals.CONNECTIONSTATE.ERRORED
            ) {
                connectionManager.stateManager.storage
                    .listDevices()
                    .then((devices) => {
                        if (devices.length > 0) {
                            connectionManager.create(
                                devices[0].path,
                                isNaN(parseInt(devices[0].baud))
                                    ? null
                                    : parseInt(devices[0].baud)
                            )
                        }
                    })
            }
            break
        default:
            console.log("Unknown state: " + new_state)
    }
}
