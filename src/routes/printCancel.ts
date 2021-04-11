import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import globals from "../globals"

export default new Route(
    "/api/print/cancel",
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
                "print_state.edit"
            )
        ) {
            return res.sendStatus(401)
        }

        if (
            ![
                globals.CONNECTIONSTATE.PRINTING,
                globals.CONNECTIONSTATE.PREPARING,
            ].includes(server.stateManager.state)
        ) {
            return res
                .status(403)
                .json({ error: true, message: "Not currently printing" })
        }

        server.stateManager.printManager
            .cancel()
            .then(() => res.sendStatus(200))
            .catch((e) => {
                res.sendStatus(500)
                console.error(e)
            })
    }
)
