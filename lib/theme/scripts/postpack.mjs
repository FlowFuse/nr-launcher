import { join } from 'path'
import { rmdirSync, existsSync } from 'fs'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))
const packDir = join(__dirname, 'lib')
const resDir = join(__dirname, 'resources')

// Delete the temporary pack directory
if (existsSync(packDir)) {
    rmdirSync(packDir, { recursive: true })
}
// Delete the duplicate resources directory
if (existsSync(resDir)) {
    rmdirSync(resDir, { recursive: true })
}
