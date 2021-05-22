import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import LogPriority from "../enums/logPriority"
import Setting from "../enums/setting"
import globals from "../globals"
import SerialConnectionManager from "../serial"
import * as Sentry from "@sentry/node"

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
            let settings = await server.stateManager.storage.getSettings()

            if (!settings.get(Setting.DevicePath)) {
                return res.status(403).json({
                    error: true,
                    message: "Device path is not set.",
                })
            }

            await connect(
                server.stateManager.connectionManager,
                settings.get(Setting.DevicePath) as string,
                settings.get(Setting.DeviceBaud) as number
            )
            return res.sendStatus(200)
        } catch (e) {
            Sentry.captureException(e)
            res.sendStatus(500)
        }
    }
)

function connect(
    connectionManager: SerialConnectionManager,
    path: string,
    baud?: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        connectionManager.create(path, baud).then(resolve).catch(reject)
    })
}
