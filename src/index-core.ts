import express from "express"
import fs from "fs-extra"
import { M2M_CIN, Thyme, ThymeAE, ThymeContainer, ThymeCSE, ThymeProtocol } from "ncube-thyme-typescript"

import { DetectedFace, detectFaces } from "./humandetection"
import { SnapshotCamera } from "./snapshotcamera"
import {
  aeName,
  cameraConfig,
  createTemp,
  execAsync,
  httpPort,
  Range,
  readConfig,
} from "./util"

const nmInterval = 600000
const firstInterval = 30000

let hasCamera:boolean
const httpServer = express()
let snapshot:SnapshotCamera = null

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
httpServer.get("/camera_detection", async (req, res) => {
  try {
    const photo = await snapshot.requestSnapshot()
    let faces:DetectedFace[]
    const buf = await createTemp("jpg", photo, async (path, content) => {
      faces = await detectFaces(false, path, path, detectionMap)
      const buf = await fs.readFile(path)
      return buf
    })
    const people = getPeople(faces)
    await thymePeople.addContentInstance(people.join(""))
    console.log(await thymePeople.queryLastValue())

    res.contentType("image/jpeg")
    res.send(buf)
  } catch (err) {
    console.log(err)
    res.statusCode = 500
    res.send("Internal Server Error")
  }
})

const detectionMap:Array<Range> = [
  [[0.00, 0.00], [0.33, 0.33]],
  [[0.33, 0.00], [0.66, 0.33]],
  [[0.66, 0.00], [1, 0.33]],
  [[0.00, 0.33], [0.33, 0.66]],
  [[0.33, 0.33], [0.66, 0.66]],
  [[0.66, 0.33], [1, 0.66]],
  [[0.00, 0.66], [0.33, 1]],
  [[0.33, 0.66], [0.66, 1]],
  [[0.66, 0.66], [1, 1]],
]

function checkFace(size:[number, number], r:Range, center:[number, number]) {
  const minX = Math.round(size[0] * r[0][0])
  const minY = Math.round(size[1] * r[0][1])
  const maxX = Math.round(size[0] * r[1][0])
  const maxY = Math.round(size[1] * r[1][1])
  return minX <= center[0] && minY <= center[1] && center[0] <= maxX && center[1] <= maxY
}

let thyme:ThymeCSE
let classAE:ThymeAE
let rawValue:ThymeContainer
let thymePeople:ThymeContainer
let wakeUp:ThymeContainer
let idle = true

let nextTask:NodeJS.Timeout = null

function getPeople(faces:DetectedFace[]) {
  const people:number[] = []
  for (let i = 0; i < detectionMap.length; i += 1) {
    people[i] = 0
  }
  for (const face of faces) {
    for (let i = 0; i < detectionMap.length; i += 1) {
      const check = checkFace([cameraConfig.width, cameraConfig.height], detectionMap[i], face.center)
      if (check) {
        people[i] += 1
        console.log("Detected Face " + i)
      }
    }
  }
  return people
}

async function detection(nextTimeout?:number) {
  const start = Date.now()
  const photo = await snapshot.requestSnapshot()
  const faces = await createTemp("jpg", photo, async (path) => {
    return detectFaces(true, path, path)
  })
  const people = getPeople(faces)
  await thymePeople.addContentInstance(people.join(""))
  const v = await thymePeople.queryLastValue() // this is "NOT" string
  console.log(v)
  const interval = Math.max(nextTimeout ?? nmInterval, (start + (nextTimeout ?? nmInterval)) - Date.now())
  console.log(interval)
  nextTask = setTimeout(detection, interval) // 10min
}

async function setup() {
  try {
    await execAsync(
      `v4l2-ctl --set-fmt-video=width=${cameraConfig.width},height=${cameraConfig.height},pixelformat=3`
    )
    hasCamera = true
  } catch (err) {
    hasCamera = false
    console.error("Camera not detected. Falling back to remote mode.")
  }

  const remoteIP = await readConfig("remoteip", "127.0.0.1")
  snapshot = new SnapshotCamera(hasCamera, `${remoteIP}:${httpPort}`)

  const _thyme = new Thyme({
    main: {
      type: ThymeProtocol.MQTT,
      host: "203.253.128.177",
      port: 1883,
    },
  })
  await _thyme.connect()
  thyme = await _thyme.getCSEBase("Mobius", "Mobius2")
  classAE = await thyme.ensureApplicationEntity(aeName)
  rawValue = await classAE.ensureContainer("camera_raw", 1000 * 1000 * 5)
  thymePeople = await classAE.ensureContainer("cam", 10240)
  wakeUp = await classAE.ensureContainer("camera_wake", 1024, true)
  wakeUp.on("changed", (value, cin) => {
    const nowIdle = value === "0"
    if (nowIdle != idle) {
      if (nextTask != null) {
        clearTimeout(nextTask)
      }
      if (!nowIdle) {
        detection(firstInterval)
      }
    }
    idle = nowIdle
  })
  let nIdle = false
  try {
    nIdle = await wakeUp.queryLastValue() === "0"
  } catch (err) {
    console.log(err)
    // .
  }
  await wakeUp.addContentInstance(nIdle ? "0" : "1")
}

setup()