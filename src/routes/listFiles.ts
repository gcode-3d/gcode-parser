import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"

export default new Route("/api/files", "GET", 0, async (req, res, server) => {
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
        if (!permissions["file.access"] && !permissions["admin"]) {
            return res.sendStatus(401)
        }
        var files = await server.stateManager.storage.getFileList()
        return res.json(files)
    } catch (e) {
        console.error(e)
        return res.sendStatus(500)
    }
})
