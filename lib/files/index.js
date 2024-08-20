const { mkdir, readdir, rm, rename, stat, writeFile } = require('fs/promises')
const { existsSync } = require('fs')
const { dirname, join, normalize } = require('path')
const multer = require('multer')

const filesInterface = (app, settings) => {
    const BASE_PATH = join(settings.rootDir, settings.userDir, 'storage')
    // not sure about this yet, need to check how file storage works
    const storage = multer.memoryStorage()
    const upload = multer({ storage })

    const regex = /^\/flowforge\/files\/_\/(.*)$/

    const listDirectory = async (path = '') => {
        const fullPath = normalize(join(BASE_PATH, path))
        if (fullPath.startsWith(BASE_PATH)) {
            const files = await readdir(fullPath, { withFileTypes: true })
            const response = {
                meta: { },
                files: [],
                count: files.length
            }
            for (const i in files) {
                const file = files[i]
                const filePath = join(fullPath, file.name)
                const s = await stat(filePath)
                const rep = {
                    name: file.name,
                    lastModified: s.mtime
                }
                if (file.isFile()) {
                    rep.type = 'file'
                    rep.size = s.size
                } else if (file.isDirectory()) {
                    rep.type = 'directory'
                }
                response.files.push(rep)
            }
            return response
        } else {
            return []
        }
    }

    app.get(regex, async (request, reply) => {
        try {
            const files = await listDirectory(request.params[0])
            reply.send(files)
        } catch (err) {
            console.log(err)
            if (err.code === 'ENOENT') {
                reply.status(404).send()
            } else if (err.code === 'ENOTDIR') {
                reply.status(400).send()
            } else {
                console.log('unknown error')
                reply.status(400).send()
            }
        }
    })

    app.put(regex, async (request, reply) => {
        const fullPath = normalize(join(BASE_PATH, request.params[0]))
        const newPath = normalize(join(BASE_PATH, request.body.path))
        if (fullPath.startsWith(BASE_PATH) && newPath.startsWith(BASE_PATH)) {
            if (existsSync(fullPath) && existsSync(dirname(newPath))) {
                await rename(fullPath, newPath)
                reply.status(202).send()
            } else {
                reply.status(404).send()
            }
        }
        reply.status(403).send()
    })

    app.post(regex, upload.single('file'), async (request, reply) => {
        const startPath = normalize(join(BASE_PATH, request.params[0]))
        console.log(startPath)
        if (startPath.startsWith(BASE_PATH)) {
            console.log(request.get('content-type'))
            if (request.get('content-type') === 'application/json') {
                const newPath = request.body.path
                const fullPath = normalize(join(startPath, newPath))
                console.log(fullPath)
                if (fullPath.startsWith(BASE_PATH)) {
                    await mkdir(fullPath, { recursive: true })
                    reply.status(201).send()
                } else {
                    console.log('problem')
                    reply.status(500).send()
                }
            } else if (request.get('content-type').startsWith('multipart/form-data')) {
                await writeFile(startPath, request.file.buffer)
                reply.status(201).send()
            } else {
                reply.status(406).send()
            }
        } else {
            reply.status(403).send()
        }
    })

    app.delete(regex, async (request, reply) => {
        const fullPath = normalize(join(BASE_PATH, request.params[0]))
        if (fullPath !== BASE_PATH && fullPath.startsWith(BASE_PATH)) {
            if (existsSync(fullPath)) {
                await rm(fullPath, {
                    force: true,
                    recursive: true
                })
                reply.status(204).send()
            } else {
                reply.status(404).send()
            }
        } else {
            reply.status(403).send()
        }
    })
}

module.exports = {
    filesInterface
}
