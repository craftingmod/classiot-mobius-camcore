
import Path from "path"


import express from "express"
import fs from "fs-extra"
import { Container, Thyme } from "ncube-thyme-typescript"
import cv from "opencv4nodejs"

import { detectFaces } from "./humandetection"
import { SnapshotCamera } from "./snapshotcamera"
import { cameraConfig, configPath, createTemp, execAsync, httpPort, inputPath, readConfig, tempPath } from "./util"


// ensure path

let is_rasp = false
let snapshot:SnapshotCamera
let container:Container
let prevData = ""

const httpServer = express()
const thyme = new Thyme("Mobius", {
  host: "203.253.128.177",
  port: 7579,
  protocol: "http",
})

httpServer.listen(httpPort, () => {
  console.log(`Listening at http://localhost:${httpPort}`)
})
httpServer.get("/camera", async (req, res) => {
  try {
    const photo = await snapshot.requestSnapshot()
    const buf = await createTemp("jpg", photo, async (path, content) => {
      if (!is_rasp) {
        await detectFaces(false, path, path)
      }
      const buf = await fs.readFile(path)
      return buf
    })
    res.contentType("image/jpeg")
    res.send(buf)
  } catch (err) {
    console.log(err)
    res.statusCode = 500
    res.send("Internal Server Error")
  }
})


/**
 * Setup before main
 */
async function setup() {
  // connect Thyme
  await thyme.connect()
  // get sensor value
  const ae = await thyme.ensureApplicationEntity("classIoT")
  container = await thyme.ensureContainer(ae, "camera_human")
  // ensure dir
  await fs.ensureDir(inputPath)
  await fs.ensureDir(tempPath)
  // check is rasp
  is_rasp = await readConfig("is_rasp", "true") === "true"
  const remoteIP = await readConfig("remoteip", "127.0.0.1")
  // init snapshotcamera
  snapshot = new SnapshotCamera(is_rasp, `${remoteIP}:${httpPort}`)
  // set camera
  if (is_rasp) {
    await execAsync(`v4l2-ctl --set-fmt-video=width=${cameraConfig.width},height=${cameraConfig.height},pixelformat=3`)
  }
}

async function main() {
  if (!is_rasp) {
    // return;
  }
  const start = Date.now()
  const photo = await snapshot.requestSnapshot()
  const faces = await createTemp("jpg", photo, async (path) => {
    return detectFaces(true, path, path)
  })
  const sendData = JSON.stringify({
    ppl: faces.length,
    loc: faces.map((v) => [...v.location, ...v.size]),
  })
  if (prevData != sendData) {
    prevData = sendData
    console.log(sendData)
    await thyme.addContentInstance(container, sendData)
  }

  setTimeout(main, Math.max(200, 1000-(Date.now() - start)))

  // const img = await cv.imreadAsync(Path.resolve(inputPath, "sample1.png"))
  // const grayImg = await img.bgrToGrayAsync()
  // const { objects, numDetections } = await classifier.detectMultiScaleAsync(grayImg)
  // if (objects.length <= 0) {
  //   console.log("No face detected!")
  //   return
  // }

  // // draw detection
  // const facesImg = img.copy()
  // const numDetectionsTh = 10
  // objects.forEach((rect, i) => {
  //   const thickness = numDetections[i] < numDetectionsTh ? 1 : 2
  //   facesImg.drawRectangle(rect, new cv.Vec3(255, 0, 0), thickness, cv.LINE_8)
  // })

  // await cv.imwriteAsync(Path.resolve(inputPath, "sample1_output.png"), facesImg)
}

try {
  setup().then(() => main())
} catch (err) {
  console.error(err)
}

