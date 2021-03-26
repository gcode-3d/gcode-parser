import Route from "../classes/route"

export default new Route("/api/ping", "GET", 2, (_req, res, _ws) => {
    res.status(200).send("Pong!")
})
