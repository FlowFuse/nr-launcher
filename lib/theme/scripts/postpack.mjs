import { join } from 'path'
import { rmdirSync, existsSync } from 'fs'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('..', import.meta.url))
const packDir = join(__dirname, 'lib')

// Delete the temporary pack directory
if (existsSync(packDir)) {
    rmdirSync(packDir, { recursive: true })
}
