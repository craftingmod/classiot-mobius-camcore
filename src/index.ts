import Path from "path"

import cv from "opencv4nodejs"

const inputPath = Path.resolve(process.cwd(), "input")

const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2)

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
  main()
} catch (err) {
  console.error(err)
}

