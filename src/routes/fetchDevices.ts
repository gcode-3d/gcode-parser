import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import * as Sentry from "@sentry/node"

export default new Route(
    "/api/fetchDevices",
    "GET",
    2,
    async (req, res, server) => {
        try {
            let userInfo

            if (!server.isInSetupMode) {
                if (!req.headers.authorization) {
                    return res.sendStatus(401)
                }
                if (!req.headers.authorization.startsWith("auth-")) {
                    return res.sendStatus(401)
                }
                var token = req.headers.authorization.replace("auth-", "")
                userInfo = await server.stateManager.storage.validateToken(
                    token
                )
            } else {
                userInfo = new UserTokenResult("SETUP", null, 1)
            }
            if (!userInfo) {
                return res.sendStatus(401)
            }
            userInfo = userInfo as UserTokenResult
            const permissions = userInfo.permissions.serialize()
            if (
                permissions["admin"] ||
                (permissions["connection.edit"] && permissions["settings.edit"])
            ) {
                server.stateManager.connectionManager
                    .list()
                    .then((list: any) => {
                        return res.json(list)
                    })
                    .catch((e: any) => {
                        Sentry.captureException(e)
                        console.error(e)
                    })
            } else {
                return res.sendStatus(403)
            }
        } catch (e) {
            console.error(e)
            Sentry.captureException(e)
            res.sendStatus(500)
        }
    }
)
