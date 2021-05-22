import Route from "../classes/route"
import loginScheme from "../schemes/login"

export default new Route("/api/login", "POST", 0, (req, res, server) => {
    loginScheme
        .validateAsync(req.body)
        .then(async (value) => {
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

                return res.json({
                    error: true,
                    message: detail.message.replace(/"/g, ""),
                })
            }
            return res.json({
                error: true,
                message:
                    "Something went wrong while logging you in. Try again later.",
            })
        })
})
