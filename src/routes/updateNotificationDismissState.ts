import Route from "../classes/route"

export default new Route(
    "/api/notifications/dismiss/:id/:bool",
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
            if (!req.params || !req.params.id) {
                return res.status(400).json({
                    error: true,
                    message: "No id specified",
                })
            }
            if (!req.params.bool) {
                return res.status(400).json({
                    error: true,
                    message: "No state specified",
                })
            }
            if (!["0", "1"].includes(req.params.bool)) {
                return res.status(400).json({
                    error: true,
                    message: "Invalid state",
                })
            }
            const v4 = new RegExp(
                /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/gi
            )
            if (!req.params.id.match(v4)) {
                return res.status(400).json({
                    error: true,
                    message: "Id is not valid.",
                })
            }

            await server.stateManager.storage.dismissNotification(
                req.params.id,
                req.params.bool == "1"
            )

            return res.json({
                newState: req.params.bool == "1",
            })
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
