import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import Setting from "../enums/setting"

export default new Route(
    "/api/settings/",
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
            if (
                !(userInfo as UserTokenResult).permissions.hasPermission(
                    "settings.edit"
                )
            ) {
                return res.sendStatus(401)
            }

            if (!req.body || !req.body.settingName) {
                return res.status(400).json({
                    error: true,
                    message: 'No "settingName" specified in body.',
                })
            }
            if (!req.body || !req.body.settingValue) {
                return res.status(400).json({
                    error: true,
                    message: 'No "settingValue" specified in body.',
                })
            }
            if (!Object.values(Setting).includes(req.body.settingName)) {
                return res
                    .status(404)
                    .json({ error: true, message: "Setting is unknown" })
            }
            let value

            switch (req.body.settingName.slice(0, 2)) {
                case "S_":
                    value = req.body.settingValue as string
                    break
                case "B_":
                    if (!["true", "false"].includes(req.body.settingValue)) {
                        return res.status(400).json({
                            error: true,
                            message: 'Expected value type "Boolean".',
                        })
                    }
                    value = req.body.settingValue == "true"
                    break
                case "N_":
                    if (isNaN(parseFloat(req.body.settingValue))) {
                        return res.status(400).json({
                            error: true,
                            message: 'Expected value type "Number".',
                        })
                    }
                    value = parseFloat(req.body.settingValue)
                    break
                default:
                    return res.status(400).json({
                        error: true,
                        message: "Unknown type detected",
                    })
            }

            await server.stateManager.storage.setSetting(
                req.body.settingName as Setting,
                value
            )
            server.stateManager.webserver.sendSettingUpdateEvent(
                req.body.settingName as Setting,
                typeof value == "string" ? value : value.toString()
            )
            res.sendStatus(200)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
