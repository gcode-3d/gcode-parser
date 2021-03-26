import Route from "../classes/route"

export default new Route("1", "MIDDLEWARE", 2, (req, res, _, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    if (req.url.startsWith("/api/files")) {
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT")
    } else if (req.url.startsWith("/api/file")) {
        res.setHeader("Access-Control-Allow-Methods", "GET, DELETE")
    } else {
        res.setHeader("Access-Control-Allow-Methods", "GET, POST")
    }
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-Requested-With,content-type, Authorization, X-force-upload"
    )
    if (req.method === "OPTIONS") {
        return res.sendStatus(200)
    }
    next()
})
