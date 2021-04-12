import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import globals from "../globals"

export default new Route(
    "/api/terminal/",
    "POST",
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
                "terminal.send"
            )
        ) {
            return res.sendStatus(401)
        }

        if (!req.body || !req.body.message) {
            return res.status(400).json({
                error: true,
                message: "Missing message in body",
            })
        }

        if (
            [
                globals.CONNECTIONSTATE.PRINTING,
                globals.CONNECTIONSTATE.PREPARING,
                globals.CONNECTIONSTATE.FINISHING,
            ].includes(server.stateManager.state)
        ) {
            return res.status(403).json({
                error: true,
                message: "Cannot send messages while printing.",
            })
        }
        if (server.stateManager.state !== globals.CONNECTIONSTATE.CONNECTED) {
            return res
                .status(403)
                .json({ error: true, message: "Printer is not connected" })
        }

        let messageId = server.stateManager.connectionManager.send(
            req.body.message
        )
        res.json({
            messageId,
        })
    }
)
