import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import LogPriority from "../enums/logPriority"
import globals from "../globals"
import * as Sentry from "@sentry/node"

export default new Route("/api/print/", "PUT", 0, async (req, res, server) => {
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

    if (!req.body || !req.body.printName) {
        return res.status(400).json({
            error: true,
            message: '"printName" not specified in body',
        })
    }
    if (
        ![globals.CONNECTIONSTATE.CONNECTED].includes(server.stateManager.state)
    ) {
        return res
            .status(403)
            .json({ error: true, message: "Not ready to print" })
    }
    server.stateManager.storage
        .checkFileExistsByName(req.body.printName)
        .then((exists) => {
            if (!exists) {
                return res.sendStatus(404)
            }
            server.stateManager.printManager
                .startPrint(req.body.printName)
                .then(() => {
                    return res.sendStatus(201)
                })
                .catch((e) => {
                    Sentry.captureException(e)
                    res.sendStatus(500)
                })
        })
        .catch((e) => {
            Sentry.captureException(e)
            res.sendStatus(500)
        })
})
