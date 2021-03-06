const fetch = require("node-fetch")
const fs = require("fs")
const path = require("path")
const StreamZip = require("node-stream-zip")

console.log("[PROD] - Downloading dist.zip from GitHub latest stable release")
fetch("https://github.com/gcode-3d/client/releases/latest/download/dist.zip")
    .then((res) => {
        const dest = fs.createWriteStream("./dist.zip")
        res.body.pipe(dest)
        dest.on("finish", async () => {
            console.log("[PROD] - Finished downloading dist.zip from GitHub")
            await clearBuildFolder()
            const zip = new StreamZip.async({ file: "./dist.zip" })
            const extracted = await zip.extract(null, "./build/client")
            console.log(`[PROD] - Extracted ${extracted} entries from zip`)
            console.log(`[PROD] - Finished updating build files`)
            process.exit()
        })
    })
    .catch(console.error)

function clearBuildFolder() {
    return new Promise(function (resolve, reject) {
        fs.readdir("./build/client", (err, files) => {
            if (err) {
                if (err.code == "ENOENT") {
                    fs.mkdirSync("./build/client", { recursive: true })
                    // Build folder doesn't exist yet, create folder.
                    return resolve()
                }
                return reject(err)
            }
            for (const file of files) {
                fs.unlinkSync(path.join("./build/client", file))
            }
            resolve()
        })
    })
}
