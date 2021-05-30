
import { exec } from "child_process"
import Path from "path"

import fs from "fs-extra"

export const httpPort = 7245
export const cameraConfig = {
  width: 3280,
  height: 2464,
}
export const aeName = "schclass414"

export const basePath = process.cwd()
export const inputPath = Path.resolve(basePath, "input")
export const tempPath = Path.resolve(basePath, "temp")
export const configPath = Path.resolve(basePath, "config")

export type Range = [[number, number], [number, number]]

export function execAsync (cmd:string) {
  return new Promise<string>((res, rej) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err != null) {
        rej(err)
      }
      if (stderr == null || stderr.length <= 0) {
        res(stdout)
      } else {
        res(stderr)
      }
    })
  })
}

export async function readConfig(name:string, defValue:string) {
  await fs.ensureDir(configPath)
  const path = Path.resolve(configPath, `${name}.txt`)
  if (!await fs.pathExists(path)) {
    await fs.writeFile(path, defValue, {encoding: "utf8"})
    return defValue
  } else {
    return await fs.readFile(path, "utf8")
  }
}

export async function createTemp<T, V extends Buffer | string | null>(fileType:string, fileContent:V, func:(path:string, content:V) => Promise<T>) {
  await fs.ensureDir(tempPath)
  let fileName:string
  do {
    fileName = `${(Math.random() * 2147483648).toString(16)}.${fileType}`
  } while (await fs.pathExists(fileName))
  const filePath = Path.resolve(tempPath, fileName)
  if (fileContent == null) {
    await fs.createFile(filePath)
  } else if (fileContent instanceof Buffer) {
    await fs.writeFile(filePath, fileContent as Buffer)
  } else {
    await fs.writeFile(filePath, fileContent as string, {encoding: "utf8"})
  }
  const result = await func(filePath, fileContent)
  await fs.rm(filePath)
  return result
}