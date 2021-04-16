import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route(
    "/api/settings",
    "GET",
    0,
    async (req, res, server) => {
        try {
            if (!req.headers.authorization) {
                return res.sendStatus(401)
            }
            var token = req.headers.authorization.replace("auth-", "")
            var userInfo = await server.stateManager.storage.validateToken(
                token
            )
            if (!userInfo) {
                return res.sendStatus(401)
            }
            if (
                !(userInfo as UserTokenResult).permissions.hasPermission(
                    "settings.edit"
                )
            ) {
                return res.sendStatus(401)
            }
            var settings = await server.stateManager.storage.getSettings()

            return res.json(Object.fromEntries(settings))
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
