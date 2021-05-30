import Path from "path"

import express from "express"
import fs from "fs-extra"
import {
  Container,
  Thyme,
  ThymeAE,
  ThymeContainer,
  ThymeProtocol,
} from "ncube-thyme-typescript"
import cv from "opencv4nodejs"

import { detectFaces } from "./humandetection"
import { SnapshotCamera } from "./snapshotcamera"
import {
  cameraConfig,
  configPath,
  createTemp,
  execAsync,
  httpPort,
  inputPath,
  readConfig,
  tempPath,
} from "./util"

// ensure path

let is_rasp = false
let snapshot: SnapshotCamera
let container: Container
let prevData = ""

const httpServer = express()
const thyme = new Thyme({
  main: {
    type: ThymeProtocol.MQTT,
    host: "203.253.128.177",
    port: 1883,
  },
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
let ae: ThymeAE
let chairs: ThymeContainer
let cameraInterval: ThymeContainer
let cameraIntervalms: number
async function setup() {
  // connect Thyme
  await thyme.connect()
  const mobius = await thyme.getCSEBase("Mobius", "Mobius2")
  // get sensor value
  ae = await mobius.ensureApplicationEntity("schclass_dev")
  chairs = await ae.ensureContainer("chair", 1024)
  cameraInterval = await ae.ensureContainer("camera_interval", 1024)
  try {
    cameraIntervalms = Number.parseInt(await cameraInterval.queryLastValue())
  } catch (err) {
    cameraIntervalms = 1000
  }
  cameraInterval.on("changed", (value) => {
    try {
      cameraIntervalms = Math.max(1000, Number.parseInt(value))
    } catch (err) {
      cameraIntervalms = 1000
    }
  })
  // ensure dir
  await fs.ensureDir(inputPath)
  await fs.ensureDir(tempPath)
  // check is rasp
  is_rasp = (await readConfig("is_rasp", "true")) === "true"
  const remoteIP = await readConfig("remoteip", "127.0.0.1")
  // init snapshotcamera
  snapshot = new SnapshotCamera(is_rasp, `${remoteIP}:${httpPort}`)
  // set camera
  if (is_rasp) {
    await execAsync(
      `v4l2-ctl --set-fmt-video=width=${cameraConfig.width},height=${cameraConfig.height},pixelformat=3`
    )
  }
  console.log("Setup complete")
}

async function main() {
  console.log("Do main")
  if (!is_rasp) {
    return
  }
  const start = Date.now()
  const photo = await snapshot.requestSnapshot()
  const faces = await createTemp("jpg", photo, async (path) => {
    return detectFaces(true, path, path)
  })
  const people = [0, 0, 0, 0, 0, 0]
  const xedges = [0.33, 0.66, 1]
  const yedges = [0.33, 0.66, 1]
  for (const face of faces) {
    let detected = false
    for (let x = 0; x < xedges.length; x += 1) {
      const xedge_abs = cameraConfig.width * xedges[x]
      for (let y = 0; y < yedges.length; y += 1) {
        const yedge_abs = cameraConfig.height * yedges[y]
        if (face.center[0] < xedge_abs && face.center[1] < yedge_abs) {
          detected = true
          people[yedges.length * y + x] += 1
          break
        }
      }
      if (detected) {
        break
      }
    }
  }

  const sendData = JSON.stringify(people)
  if (prevData != sendData) {
    prevData = sendData
    console.log(sendData)
    await chairs.addContentInstance(sendData)
  }

  setTimeout(main, Math.max(200, cameraIntervalms - (Date.now() - start)))

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
