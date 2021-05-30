import EventEmitter from "events"
import Path from "path"

import fs from "fs-extra"
import got from "got/dist/source"

import { execAsync, tempPath } from "./util"

export class SnapshotCamera extends EventEmitter {
  private taking = false
  private isRasp: boolean
  private remote = ""
  constructor(rasp: boolean, remoteHost?: string) {
    super()
    this.isRasp = rasp
    if (remoteHost != null) {
      this.remote = remoteHost
    }
  }
  public async requestSnapshot() {
    if (!this.taking) {
      this.takeSnapshot()
    }
    return new Promise<Buffer>((res, rej) => {
      // eslint-disable-next-line prefer-const
      let err: (e: unknown) => void
      const ok = (binary: Buffer) => {
        this.off("error", err)
        res(binary)
      }
      err = (e: unknown) => {
        this.off("taken", ok)
        rej(e)
      }
      this.once("taken", ok)
      this.once("error", err)
    })
  }
  protected async takeSnapshot() {
    this.taking = true
    const fileName = `${Math.floor(Math.random() * 32767).toString(16)}.jpg`
    const filePath = Path.resolve(tempPath, fileName)
    try {
      let binary: Buffer
      if (this.isRasp) {
        await execAsync(
          `v4l2-ctl --stream-mmap=3 --stream-count=1 --stream-to="${filePath}"`
        )
        binary = await fs.readFile(filePath)
        await fs.rm(filePath)
      } else {
        const response = await got(`http://${this.remote}/camera`, {
          responseType: "buffer",
        })
        if (response.statusCode == 200) {
          binary = response.rawBody
        } else {
          throw new Error("Server response is " + response.statusCode)
        }
      }
      this.emit("taken", binary)
      this.taking = false
    } catch (err) {
      console.error(err)
      this.emit("error", err)
      this.taking = false
    }
  }
}
