import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import { UploadedFile } from "express-fileupload"

export default new Route("/api/files", "PUT", 0, async (req, res, server) => {
    try {
        if (!req.headers.authorization) {
            return res.sendStatus(401)
        }
        var token = req.headers.authorization.replace("auth-", "")
        var userInfo = await server.stateManager.storage.validateToken(token)
        if (!userInfo) {
            return res.sendStatus(401)
        }
        userInfo = userInfo as UserTokenResult
        const permissions = userInfo.permissions.serialize()
        if (!permissions["file.edit"] && !permissions["admin"]) {
            return res.sendStatus(401)
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send("No files were uploaded.")
        } else if (Object.keys(req.files).length !== 1) {
            return res.status(400).send("Only upload 1 file at a time.")
        } else if (!req.files["file"]) {
            return res.status(400).send("NO files were uploaded.")
        }

        let file = req.files["file"] as UploadedFile
        if (file.truncated) {
            return res.sendStatus(413)
        }
        const exists = await server.stateManager.storage.checkFileExistsByName(
            file.name
        )
        if (
            exists &&
            (req.headers["x-force-upload"] == null ||
                req.headers["x-force-upload"] != "true")
        ) {
            return res.status(409).send("This file already exists.")
        } else if (req.headers["x-force-upload"] == "true") {
            await server.stateManager.storage.removeFileByName(file.name)
        }
        server.stateManager.storage
            .insertFile(file.name, file.data)
            .then(() => {
                res.sendStatus(200)
            })
            .catch((e) => {
                console.error(e)
                res.sendStatus(500)
            })
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})
