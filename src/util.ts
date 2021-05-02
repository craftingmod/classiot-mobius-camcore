
import { exec } from "child_process"
import Path from "path"

import fs from "fs-extra"


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

export const basePath = process.cwd()
export const inputPath = Path.resolve(basePath, "input")
export const tempPath = Path.resolve(basePath, "temp")
export const configPath = Path.resolve(basePath, "config")