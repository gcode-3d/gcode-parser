import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route(
    "/api/files/rename",
    "POST",
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
            if (!req.body || !req.body.new_name || !req.body.old_name) {
                return res.sendStatus(400)
            }
            const old_exists = await server.stateManager.storage.checkFileExistsByName(
                req.body.old_name
            )
            if (!old_exists) {
                return res.status(404).send("This file doesn't exist.")
            }
            const new_exists = await server.stateManager.storage.checkFileExistsByName(
                req.body.new_name
            )
            if (new_exists) {
                return res.status(400).send("The new filename exists already.")
            }
            if (new TextEncoder().encode(req.body.new_name).length > 250) {
                return res.status(400).send("New filename is too large")
            }
            await server.stateManager.storage.updateFileName(
                req.body.old_name,
                req.body.new_name
            )
            res.sendStatus(200)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
