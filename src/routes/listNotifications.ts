import Route from "../classes/route"
import NotificationType from "../enums/notificationType"

export default new Route(
    "/api/notifications",
    "GET",
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

            let notifications = await server.stateManager.storage.listNotifications()
            let modifiedNotifications = notifications.map((notification) => {
                return {
                    id: notification.id,
                    date: notification.date.toISOString(),
                    content: notification.content,
                    type: NotificationType[notification.type],
                    dismissed: notification.dismissed == true,
                    dismissTime: notification.dismissTime || null,
                }
            })
            return res.json(modifiedNotifications)
        } catch (e) {
            console.error(e)
            return res.sendStatus(500)
        }
    }
)
