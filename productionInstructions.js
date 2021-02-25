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
            const extracted = await zip.extract(null, "./build")
            console.log(`[PROD] - Extracted ${extracted} entries from zip`)
            console.log(`[PROD] - Finished updating build files`)
            process.exit()
        })
    })
    .catch(console.error)

function clearBuildFolder() {
    return new Promise(function (resolve, reject) {
        fs.readdir("./build", (err, files) => {
            if (err) {
                return reject(err)
            }
            for (const file of files) {
                fs.unlinkSync(path.join("./build", file))
            }
            resolve()
        })
    })
}
