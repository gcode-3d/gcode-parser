import fetch from "node-fetch"
import fs from "fs"
import path from "path"
import StreamZip from "node-stream-zip"
export default (): Promise<string> => {
    return new Promise((resolve, reject) => {
        fetch(
            "https://github.com/gcode-3d/setup_wizard/releases/latest/download/dist.zip"
        )
            .then((res) => {
                const dest = fs.createWriteStream("./setup_wizard.zip")
                res.body.pipe(dest)
                dest.on("finish", async () => {
                    await clearBuildFolder()
                    const zip = new StreamZip.async({
                        file: "./setup_wizard.zip",
                    })
                    await zip.extract("dist", "./build/setup_wizard")
                    resolve("build/setup_wizard")
                })
            })
            .catch(reject)
    })
}
function clearBuildFolder() {
    return new Promise<void>(function (resolve, reject) {
        fs.readdir("./build/setup_wizard", (err, files) => {
            if (err) {
                if (err.code == "ENOENT") {
                    fs.mkdirSync("./build/setup_wizard", { recursive: true })
                    // Build folder doesn't exist yet, create folder.
                    return resolve()
                }
                return reject(err)
            }
            for (const file of files) {
                fs.unlinkSync(path.join("./build/setup_wizard/", file))
            }
            resolve()
        })
    })
}
