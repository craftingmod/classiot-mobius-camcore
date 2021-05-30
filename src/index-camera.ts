import express from "express"
import fs from "fs-extra"
import { M2M_CIN, Thyme, ThymeAE, ThymeContainer, ThymeCSE, ThymeProtocol } from "ncube-thyme-typescript"

import { SnapshotCamera } from "./snapshotcamera"
import {
  aeName,
  cameraConfig,
  createTemp,
  execAsync,
  httpPort,
} from "./util"

const httpServer = express()
const snapshot = new SnapshotCamera(true, `127.0.0.1:${httpPort}`)

httpServer.listen(httpPort, () => {
  console.log(`Camera proxy is listening at http://localhost:${httpPort}`)
})
httpServer.get("/camera", async (req, res) => {
  try {
    const photo = await snapshot.requestSnapshot()
    const buf = await createTemp("jpg", photo, async (path, content) => {
      return fs.readFile(path)
    })
    res.contentType("image/jpeg")
    res.send(buf)
  } catch (err) {
    console.log(err)
    res.statusCode = 500
    res.send("Internal Server Error")
  }
})

execAsync(
  `v4l2-ctl --set-fmt-video=width=${cameraConfig.width},height=${cameraConfig.height},pixelformat=3`
)