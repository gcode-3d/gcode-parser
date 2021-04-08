import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import LogPriority from "../enums/logPriority"

const allowedTypes = ["all", "debug", "warning", "error"]

export default new Route("/api/logs", "GET", 0, async (req, res, ws) => {
    let storage = ws.stateManager.storage
    if (!req.headers || !req.headers.authorization) {
        return res.sendStatus(401)
    }
    let token = req.headers.authorization.replace("auth-", "").trim()
    let user = await storage.validateToken(token)
    if (!user) {
        return res.sendStatus(401)
    }
    user = user as UserTokenResult
    if (!user.permissions.hasPermission("settings.edit")) {
        return res.sendStatus(401)
    }
    let type = "all"
    let limit = 50
    if (
        req.query.type &&
        allowedTypes.includes(req.query.type.toString().toLowerCase())
    ) {
        type = req.query.type.toString().toLowerCase()
    }

    if (req.query.limit && !isNaN(parseInt(req.query.limit.toString()))) {
        let parsedInt = parseInt(req.query.limit.toString())
        if (parsedInt <= 0 || parsedInt > 100) {
            return res.send("limit query must be between 1 and 100").status(400)
        }
        limit = parsedInt
    }
    let transformedType: LogPriority[] = []
    switch (type) {
        case "all":
            transformedType.push(LogPriority.Debug)
            transformedType.push(LogPriority.Error)
            transformedType.push(LogPriority.Warning)
            break
        case "debug":
            transformedType.push(LogPriority.Debug)
            break
        case "error":
            transformedType.push(LogPriority.Error)
            break
        case "warning":
            transformedType.push(LogPriority.Warning)
            break
    }

    storage
        .listLogs(transformedType, limit)
        .then((entries) => {
            res.json({
                type: type,
                entries: entries,
            })
        })
        .catch((e) => {
            console.error(e)
            res.sendStatus(500)
        })
})
