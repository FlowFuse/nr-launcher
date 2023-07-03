/*
    ## prepack.mjs

    This script copies the theme files to sub directory `lib/theme` before packaging
    so that relative paths in the theme files are correct when the package is installed.

    NOTES:
    * This script is executed by the `prepack` script in package.json.
    * It is ran automatically upon `npm pack` and `npm publish`.
    * .npmignore file is used to ensure only lib/theme/** theme files are packed.
    * .gitignore file is used to ensure lib/theme/** are NOT committed.

    ### Without this script:
    the theme files would be packed at the root of the package and the relative paths
    in `forge-light/forge-light.js` and `forge-dark/forge-dark.js` would be incorrect.

    E.g. without the prepack script, the package would be structured like this...
    ├──node_modules
    │  └───@flowforge
    │      └───nr-theme
    │          ├───common
    │          ├───forge-dark
    │          └───forge-light

    With this script, the theme files are copied to a sub directory and the
    relative paths are correct...
    ├──node_modules
    │  └───@flowforge
    │      └───nr-theme
    │          └───lib
    │          |   └───theme
    │          |       ├───common
    │          |       ├───forge-dark
    │          |       └───forge-light
    |          ├───resources
*/

import { join } from 'path'
import { promises as fs, existsSync, mkdirSync } from 'fs'
import * as url from 'url'

// #region Configuration
const __dirname = url.fileURLToPath(new URL('..', import.meta.url))
const destinationDir = join(__dirname, 'lib', 'theme')
const sourceDir = __dirname
const sources = [
    'common',
    'forge-light',
    'forge-dark'
]
const resourcesSrcDir = join(__dirname, '..', '..', 'resources')
const resourcesDstDir = join(__dirname, 'resources')
// #endregion Configuration

main()

async function main () {
    // prepare lib/theme directory
    await cleanUp(destinationDir)
    ensureDirectoryExists(destinationDir)

    // prepare resources directory
    await cleanUp(resourcesDstDir)
    ensureDirectoryExists(resourcesDstDir)

    // copy theme files
    await copySources(sources, sourceDir, destinationDir)

    // copy resources
    await copyFiles(resourcesSrcDir, resourcesDstDir)
}

// #region Helper Functions
async function copySources (sources, sourceDir, destinationDir) {
    for (const source of sources) {
        const src = join(sourceDir, source)
        const dst = join(destinationDir, source)
        ensureDirectoryExists(dst)
        await copyFiles(src, dst)
    }
}

async function copyFiles (sourceDir, destinationDir) {
    const files = await fs.readdir(sourceDir)
    for (const file of files) {
        const sourceFile = join(sourceDir, file)
        const destinationFile = join(destinationDir, file)
        const stat = await fs.stat(sourceFile)
        if (stat.isDirectory()) {
            ensureDirectoryExists(destinationFile)
            await copyFiles(sourceFile, destinationFile)
        } else {
            await fs.copyFile(sourceFile, destinationFile)
        }
    }
}

function ensureDirectoryExists (dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
}

async function cleanUp (dir) {
    if (!existsSync(dir)) return
    // if it is a file, delete it using fs.unlink otherwise use fs.rmdir
    const stat = await fs.stat(dir)
    if (stat.isFile()) {
        await fs.unlink(dir)
        return
    }
    await fs.rmdir(dir, { recursive: true })
}
// #endregion Helper Functions
