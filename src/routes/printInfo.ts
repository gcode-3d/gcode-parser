import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import globals from "../globals"

export default new Route(
    "/api/print/info",
    "GET",
    0,
    async (req, res, server) => {
        if (!req.headers.authorization) {
            return res.sendStatus(401)
        }
        var result = await server.stateManager.storage.validateToken(
            req.headers.authorization.replace("auth-", "")
        )
        if (!result) {
            return res.sendStatus(401)
        }

        if (!server.stateManager.printManager.currentPrint) {
            return res
                .status(403)
                .json({ error: true, message: "Not currently printing" })
        }
        return res.json({
            name: server.stateManager.printManager.currentPrint.file.name,
            progress: server.stateManager.printManager.currentPrint.getProgress(),
            startTime: server.stateManager.printManager.currentPrint.startTime,
            endTime: server.stateManager.printManager.currentPrint.getPredictedEndTime(),
        })
    }
)
