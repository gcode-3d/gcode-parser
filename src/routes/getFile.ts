import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route(
    "/api/file/:file",
    "GET",
    0,
    async (req, res, server) => {
        try {
            if (!req.headers.authorization && !req.query.authorization) {
                return res.sendStatus(401)
            } else if (req.query.authorization) {
                req.headers.authorization = "auth-" + req.query.authorization
            }
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
            if (!permissions["file.access"] && !permissions["admin"]) {
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

            var file = await server.stateManager.storage.getFileByName(
                req.params.file
            )
            res.setHeader("X-filename", file.name)
            res.setHeader("X-upload-date", file.uploaded.toISOString())
            res.setHeader("Content-Type", "text/x-gcode")
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="' + file.name + '"'
            )
            file.data!.pipe(res)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
