
import Path from "path"


import express from "express"
import fs from "fs-extra"
import cv from "opencv4nodejs"

import { SnapshotCamera } from "./snapshotcamera"
import { configPath, execAsync, inputPath, readConfig, tempPath } from "./util"

const cameraConfig = {
  width: 2560,
  height: 1440,
}

// ensure path

let is_rasp = true
let snapshot:SnapshotCamera
const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2)

const httpServer = express()
const httpPort = 7245
httpServer.listen(httpPort, () => {
  console.log(`Listening at http://localhost:${httpPort}`)
})
httpServer.get("/camera", async (req, res) => {
  try {
    const photo = await snapshot.requestSnapshot()
    res.contentType("image/jpeg")
    res.send(photo)
  } catch (err) {
    res.statusCode = 500
    res.send("Internal Server Error")
  }
})


/**
 * Setup before main
 */
async function setup() {
  // ensure dir
  await fs.ensureDir(inputPath)
  await fs.ensureDir(tempPath)
  // check is rasp
  is_rasp = await readConfig("is_rasp", "true") === "true"
  const remoteIP = await readConfig("remoteip", "127.0.0.1")
  // init snapshotcamera
  snapshot = new SnapshotCamera(is_rasp, remoteIP)
  // set camera
  if (is_rasp) {
    await execAsync(`v4l2-ctl --set-fmt-video=width=${cameraConfig.width},height=${cameraConfig.height},pixelformat=3`)
  }
}

async function main() {
  const img = await cv.imreadAsync(Path.resolve(inputPath, "sample1.png"))
  const grayImg = await img.bgrToGrayAsync()
  const { objects, numDetections } = await classifier.detectMultiScaleAsync(grayImg)
  if (objects.length <= 0) {
    console.log("No face detected!")
    return
  }

  // draw detection
  const facesImg = img.copy()
  const numDetectionsTh = 10
  objects.forEach((rect, i) => {
    const thickness = numDetections[i] < numDetectionsTh ? 1 : 2
    facesImg.drawRectangle(rect, new cv.Vec3(255, 0, 0), thickness, cv.LINE_8)
  })

  await cv.imwriteAsync(Path.resolve(inputPath, "sample1_output.png"), facesImg)
}

try {
  setup().then(() => main())
} catch (err) {
  console.error(err)
}

