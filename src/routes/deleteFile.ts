import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route(
    "/api/file/:file",
    "DELETE",
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
            userInfo = userInfo as UserTokenResult
            const permissions = userInfo.permissions.serialize()
            if (!permissions["file.edit"] && !permissions["admin"]) {
                return res.sendStatus(401)
            }
            if (!req.params.file) {
                return res.sendStatus(400)
            }

            const exists = await server.stateManager.storage.checkFileExistsByName(
                req.params.file
            )
            if (!exists) {
                return res.status(404).send("This file doesn't exist.")
            }

            await server.stateManager.storage.removeFileByName(req.params.file)
            res.sendStatus(200)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
