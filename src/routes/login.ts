import Route from "../classes/route"
import loginScheme from "../schemes/login"

export default new Route("/api/login", "POST", 1, (req, res, server) => {
    loginScheme
        .validateAsync(req.body)
        .then(async (value) => {
            let date = new Date(value.datetime)
            let dateDiff = new Date().getTime() - date.getTime()
            if (dateDiff > 5000 || dateDiff < 0) {
                return res.sendStatus(400)
            }

            var result = await server.stateManager.storage.validateUser(
                value.username,
                value.password
            )
            if (!result) {
                return res.json({
                    error: true,
                    message: "Invalid username / password",
                })
            }
            var token = await server.stateManager.storage.generateNewToken(
                value.username,
                value.remember
            )
            // pass token to client
            return res.json({ token })
        })
        .catch((e: any) => {
            console.log(e)
            if (e.details) {
                let detail = e.details[0]
                if (detail.context.key == "datetime") {
                    return res.sendStatus(400)
                } else {
                    return res.json({
                        error: true,
                        message: detail.message.replace(/"/g, ""),
                    })
                }
            }
            return res.json({
                error: true,
                message:
                    "Something went wrong while logging you in. Try again later.",
            })
        })
})
