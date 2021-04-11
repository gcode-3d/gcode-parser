import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import LogPriority from "../enums/logPriority"
import globals from "../globals"

export default new Route(
    "/api/connection/",
    "DELETE",
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
                globals.CONNECTIONSTATE.CONNECTED,
                globals.CONNECTIONSTATE.PREPARING,
                globals.CONNECTIONSTATE.PRINTING,
                globals.CONNECTIONSTATE.FINISHING,
            ].includes(server.stateManager.state)
        ) {
            return res
                .status(403)
                .json({ error: true, message: "Not connected" })
        }

        server.stateManager.connectionManager.connection.close((err) => {
            if (err) {
                server.stateManager.storage.log(
                    LogPriority.Error,
                    "CONNECTION_DISCONNECT_CLOSE",
                    err.message
                )
                return res.sendStatus(500)
            }
            return res.sendStatus(200)
        })
    }
)
