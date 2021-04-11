import Device from "../classes/device"
import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import LogPriority from "../enums/logPriority"
import Setting from "../enums/setting"
import globals from "../globals"
import SerialConnectionManager from "../serial"

export default new Route(
    "/api/connection/",
    "PUT",
    0,
    async (req, res, server) => {
        if (!req.headers.authorization) {
            return res.sendStatus(401)
        }
        var result = await server.stateManager.storage.validateToken(
            req.headers.authorization.replace("auth-", "")
        )
        if (!result) {
            return res.sendStatus(401)
        }
        if (
            !(result as UserTokenResult).permissions.hasPermission(
                "connection.edit"
            )
        ) {
            return res.sendStatus(401)
        }

        if (
            ![
                globals.CONNECTIONSTATE.DISCONNECTED,
                globals.CONNECTIONSTATE.ERRORED,
            ].includes(server.stateManager.state)
        ) {
            return res
                .status(403)
                .json({ error: true, message: "Already connected" })
        }

        try {
            let device: Device

            if (req.body && req.body.device) {
                if (
                    req.body.device.length < 0 ||
                    req.body.device.length > 255
                ) {
                    return res.status(400).json({
                        error: true,
                        message:
                            "'Device' field is not correct. Expecting a string, 1-255 long.",
                    })
                }

                device = await server.stateManager.storage.getDeviceByName(
                    req.body.device
                )
            } else {
                let settings = await server.stateManager.storage.getSettings()
                let deviceId = settings.get(Setting.SelectedDevice)

                if (!deviceId) {
                    return res.status(403).json({
                        error: true,
                        message:
                            "No default device set up and no device specified in body",
                    })
                }

                device = await server.stateManager.storage.getDeviceByName(
                    deviceId as string
                )
            }

            if (!device) {
                return res.sendStatus(404)
            }

            await connect(server.stateManager.connectionManager, device)
            return res.sendStatus(200)
        } catch (e) {
            server.stateManager.storage.log(
                LogPriority.Error,
                "CONNECTION_ROUTE",
                e
            )
            res.sendStatus(500)
        }
    }
)

function connect(
    connectionManager: SerialConnectionManager,
    device: Device
): Promise<void> {
    return new Promise((resolve, reject) => {
        connectionManager
            .create(
                device.path,
                isNaN(parseInt(device.baud)) ? null : parseInt(device.baud)
            )
            .then(resolve)
            .catch(reject)
    })
}
