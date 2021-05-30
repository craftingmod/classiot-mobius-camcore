import Path from "path"

import fs from "fs-extra"
import cv, { Vec3 } from "opencv4nodejs"

import { basePath, Range, tempPath } from "./util"

const cascadeDir = Path.resolve(basePath, "cascades")
const faceCascades = toCascade(["haarcascade_frontalcatface_extended.xml", "haarcascade_frontalface_alt.xml", "haarcascade_frontalface_default.xml"])
const cascadeEye = toCascade(["haarcascade_eye_tree_eyeglasses.xml"])[0]

export async function detectFaces(fastMode:boolean, fromPath:string, toPath?:string, rangeMap?:Range[]) {
  const img = await cv.imreadAsync(fromPath)
  const grayImg = await img.bgrToGrayAsync()
  const facesImg = fastMode ? null : img.copy()
  // make grid of zone..?
  if (facesImg != null && rangeMap != null) {
    const w = facesImg.sizes[1]
    const h = facesImg.sizes[0]
    const f = (n:number) => Math.floor(n)
    for (const range of rangeMap) {
      facesImg.drawRectangle(new cv.Rect(
        f(range[0][0] * w), f(range[0][1] * h), f((range[1][0] - range[0][0]) * w), f((range[1][1] - range[0][1]) * h)), new cv.Vec3(0xFF, 0x00, 0x00), 2, cv.LINE_8)
    }
  }
  // save history
  const faces:cv.Rect[] = []
  const faceHistory:cv.Rect[] = []
  const detectedFaces:DetectedFace[] = []
  // detect all faces
  for (const faceCas of faceCascades) {
    const {objects:rects} = await faceCas.detectMultiScaleAsync(grayImg)
    faces.push(...rects)
  }
  // sort big -> small
  faces.sort((a, b) => b.width * b.height - a.width * a.height)
  // detect eyes (big -> small, ignore if 50% is same)
  for (const rect of faces) {
    let skipFace = false
    const orgSize = rect.width * rect.height
    for (const hist of faceHistory) {
      const dupe = rect.and(hist)
      // console.log(`orgSize: ${orgSize} / dupeSize: ${dupe.width * dupe.height}`)
      if (orgSize / 2 < dupe.width * dupe.height) {
        skipFace = true
        break
      }
    }
    if (skipFace) {
      continue
    }
    faceHistory.push(rect)
    // draw big rect
    facesImg?.drawRectangle(rect, new cv.Vec3(0x00, 0xFF, 0x00), 2, cv.LINE_8)
    // draw eye rect
    const faceRegion = img.getRegion(rect)
    const {objects:eyeResult} = await cascadeEye.detectMultiScaleAsync(faceRegion)
    let eyeNumber = 0
    for (const eye of eyeResult) {
      facesImg?.drawRectangle(new cv.Rect(rect.x + eye.x, rect.y + eye.y, eye.width, eye.height), new cv.Vec3(0x00, 0xFF, 0xFF), 2, cv.LINE_8)
      eyeNumber += 1
    }
    if (eyeNumber >= 1) {
      // face!
      const data = {
        location: [rect.x, rect.y],
        size: [rect.width, rect.height],
        center: [rect.x + Math.round(rect.width/2), rect.y + Math.round(rect.height/2)],
      }
      detectedFaces.push(data as any)
      facesImg?.drawCircle(new cv.Point2(data.center[0], data.center[1]), 10, new cv.Vec3(0xFF, 0x00, 0xFF), 10)
    }
  }
  if (facesImg != null) {
    await cv.imwriteAsync(toPath, facesImg)
  }

  return detectedFaces
}

export interface DetectedFace {
  location:[number, number], // x,y
  size:[number, number], // width, height
  center:[number, number], // centerx, centery
}

function toCascade(str:string[]) {
  return str.map((v) => new cv.CascadeClassifier(Path.resolve(cascadeDir, v)))
}