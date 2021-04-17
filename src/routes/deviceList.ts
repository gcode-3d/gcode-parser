import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route(
    "/api/deviceList",
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

            var devices = await server.stateManager.storage.listDeviceConfigNames()

            return res.json(devices)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
