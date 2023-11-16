#!/usr/bin/env node

// This script can be used to build custom colour-scheme css files.
//
// 1. Create a copy of packages/node_modules/@node-red/editor-client/src/sass/colors.scss
//    and change the values to the desired colours.
//
// 2. Run this script, providing the path to the custom file using the --in option
//    and the output will be written to the location specified by the --out option
//

const os = require('os')
const { parseArgs } = require('node:util')
const path = require('path')
const { existsSync } = require('fs')
const { readFile, mkdtemp, cp, writeFile, rm } = require('fs/promises')
const sass = require('sass')

const options = {
    help: { type: 'boolean', short: '?' },
    long: { type: 'boolean' },
    in: { type: 'string' },
    out: { type: 'string' },
    src: { type: 'string' }
}
const { values } = parseArgs({ options })

const RULE_REGEX = /(\$.*?) *: *(\S[\S\s]*?);/g
const SASS_DIR = '/packages/node_modules/@node-red/editor-client/src/sass/'

if (values.help) {
    showUsageAndExit(0)
}
if (!values.src) {
    console.warn('Missing variable: src')
    showUsageAndExit(1)
}

const nrPackagePath = path.resolve(values.src) // absolute version of path provided
const nrPackageFile = path.join(nrPackagePath, 'package.json')

if (!existsSync(nrPackagePath)) {
    console.warn(`Node-RED directory '${nrPackagePath}' not found`)
    showUsageAndExit(1)
}
if (!existsSync(nrPackageFile)) {
    console.warn(`Node-RED path is not valid. Could not find '${nrPackageFile}'`)
    showUsageAndExit(2)
}
if (!existsSync(path.join(nrPackagePath, SASS_DIR))) {
    console.warn(`Node-RED path is not valid. Could not find '${path.join(nrPackagePath, SASS_DIR)}'`)
    showUsageAndExit(3)
}

// append the verified absolute path of node-red/package.json to the values object
values.nrPackagePath = nrPackagePath
values.nrPackageFile = nrPackageFile;

(async function () {
    const themes = [
        'forge-dark',
        'forge-light'
    ]

    for (const theme of themes) {
        await generateTheme({
            in: path.resolve(path.join(__dirname, '..', theme, `${theme}-theme.scss`)),
            out: path.resolve(path.join(__dirname, '..', theme, `${theme}-theme.css`)),
            ...values
        })
    }
})()

async function generateTheme (options) {
    let match
    const customColors = {}
    // load custom colours
    if (options.in) {
        const customColorsFile = await readFile(options.in, 'utf-8')
        while ((match = RULE_REGEX.exec(customColorsFile)) !== null) {
            customColors[match[1]] = match[2]
        }
    }
    // Load base colours
    const colorsFile = await readFile(path.join(options.nrPackagePath, SASS_DIR, 'colors.scss'), 'utf-8')
    const updatedColors = []

    while ((match = RULE_REGEX.exec(colorsFile)) !== null) {
        updatedColors.push(match[1] + ': ' + (customColors[match[1]] || match[2]) + ';')
    }

    const tmpDir = os.tmpdir()
    const workingDir = await mkdtemp(`${tmpDir}${path.sep}`)
    await cp(path.join(options.nrPackagePath, SASS_DIR), workingDir, { recursive: true })
    await writeFile(path.join(workingDir, 'colors.scss'), updatedColors.join('\n'))
    const result = sass.compile(path.join(workingDir, 'style.scss'), { outputStyle: 'expanded' })
    const css = result.css.toString()
    const lines = css.split('\n')
    const colorCSS = []
    const nonColorCSS = []

    let inKeyFrameBlock = false

    lines.forEach(l => {
        if (inKeyFrameBlock) {
            nonColorCSS.push(l)
            if (/^}/.test(l)) {
                inKeyFrameBlock = false
            }
        } else if (/^@keyframes/.test(l)) {
            nonColorCSS.push(l)
            inKeyFrameBlock = true
        } else if (!/^ {2}/.test(l)) {
            colorCSS.push(l)
            nonColorCSS.push(l)
        } else if (/color|border|background|fill|stroke|outline|box-shadow/.test(l)) {
            colorCSS.push(l)
        } else {
            nonColorCSS.push(l)
        }
    })

    const nrPkg = require(options.nrPackageFile)
    const now = new Date().toISOString()

    const header = `/*
* Theme generated with Node-RED ${nrPkg.version} on ${now}
*/`

    const output = sass.compileString(colorCSS.join('\n'), { style: options.long ? 'expanded' : 'compressed' })
    if (options.out) {
        await writeFile(options.out, header + '\n' + output.css)
    } else {
        console.log(header)
        console.log(output.css.toString())
    }
    await rm(workingDir, { recursive: true })
}

function showUsageAndExit (exitCode) {
    console.log('')
    console.log('Usage:   build [-?] [--src=PATH]')
    console.log('Example: npm run build-theme -- --src=../src/node-red')
    console.log('Example: node build.js --src=../src/node-red')
    console.log('')
    console.log('Options:')
    console.log('  --src        PATH  Path to src of node-red')
    console.log('  -?, --help   Show this help')
    console.log('')
    process.exit(exitCode == null ? (options.help ? 0 : 1) : exitCode)
}
