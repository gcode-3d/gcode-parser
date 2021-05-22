import Route from "../classes/route"
import Sentry from "@sentry/node"
import Setting from "../enums/setting"
export default new Route("/api/sentry/dsn", "GET", 0, (_req, res, ws) => {
    ws.stateManager.storage
        .getSettings()
        .then((settings) => {
            if (settings.has(Setting.sentryDSN)) {
                res.json({
                    dsn: settings.get(Setting.sentryDSN),
                })
            } else {
                res.sendStatus(404)
            }
        })
        .catch((e) => {
            Sentry.captureException(e)
            res.sendStatus(500)
        })
})
