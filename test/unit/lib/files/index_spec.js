const fs = require('fs')
const os = require('os')
const path = require('path')
const should = require('should') // eslint-disable-line
const { filesInterface } = require('../../../../lib/files')

describe('Files interface', function () {
    let rootDir
    let storageDir
    let handlers

    const call = async (method, urlPath, request = {}) => {
        const result = { status: null }
        const reply = {
            status: (code) => {
                result.status = code
                return reply
            },
            send: (body) => {
                result.body = body
                return reply
            }
        }
        await handlers[method]({ params: [urlPath], get: () => undefined, ...request }, reply)
        return result
    }

    beforeEach(function () {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-files-'))
        storageDir = path.join(rootDir, 'user', 'storage')
        fs.mkdirSync(path.join(storageDir, 'sub'), { recursive: true })
        fs.mkdirSync(path.join(rootDir, 'user', 'storage-old'), { recursive: true })
        fs.writeFileSync(path.join(storageDir, 'keep.txt'), 'keep')
        fs.writeFileSync(path.join(storageDir, 'sub', 'file.txt'), 'file')
        fs.writeFileSync(path.join(rootDir, 'user', 'storage-old', 'x'), 'x')
        handlers = {}
        const app = {}
        for (const method of ['get', 'put', 'post', 'delete']) {
            app[method] = (regex, ...fns) => {
                handlers[method] = fns[fns.length - 1]
            }
        }
        filesInterface(app, { rootDir, userDir: 'user' })
    })

    afterEach(function () {
        fs.rmSync(rootDir, { recursive: true, force: true })
    })

    describe('DELETE', function () {
        for (const target of ['/', '//', '', '.', './', '../storage', '../storage/']) {
            it(`refuses ${JSON.stringify(target)} and leaves the storage directory intact`, async function () {
                const result = await call('delete', target)
                result.status.should.equal(403)
                fs.existsSync(path.join(storageDir, 'keep.txt')).should.be.true()
                fs.existsSync(path.join(storageDir, 'sub', 'file.txt')).should.be.true()
            })
        }

        it('refuses a sibling directory sharing the storage prefix', async function () {
            const result = await call('delete', '../storage-old/x')
            result.status.should.equal(403)
            fs.existsSync(path.join(rootDir, 'user', 'storage-old', 'x')).should.be.true()
        })

        it('deletes a nested file', async function () {
            const result = await call('delete', 'sub/file.txt')
            result.status.should.equal(204)
            fs.existsSync(path.join(storageDir, 'sub', 'file.txt')).should.be.false()
            fs.existsSync(path.join(storageDir, 'keep.txt')).should.be.true()
        })

        it('deletes a subdirectory given with a trailing slash', async function () {
            const result = await call('delete', 'sub/')
            result.status.should.equal(204)
            fs.existsSync(path.join(storageDir, 'sub')).should.be.false()
            fs.existsSync(path.join(storageDir, 'keep.txt')).should.be.true()
        })
    })

    describe('GET', function () {
        it('lists the storage root', async function () {
            const result = await call('get', '')
            result.body.should.have.property('count', 2)
        })

        it('does not list a sibling directory sharing the storage prefix', async function () {
            const result = await call('get', '../storage-old')
            result.body.should.not.have.property('files')
        })
    })

    describe('POST', function () {
        it('refuses a sibling directory sharing the storage prefix', async function () {
            const result = await call('post', '', {
                get: () => 'application/json',
                body: { path: '../storage-old/new' }
            })
            result.status.should.equal(500)
            fs.existsSync(path.join(rootDir, 'user', 'storage-old', 'new')).should.be.false()
        })

        it('refuses a file upload targeting the storage root', async function () {
            const result = await call('post', '//', {
                get: () => 'multipart/form-data; boundary=x',
                file: { buffer: Buffer.from('x') }
            })
            result.status.should.equal(403)
        })
    })

    describe('PUT', function () {
        it('refuses renaming the storage root', async function () {
            const result = await call('put', '//', { body: { path: 'moved' } })
            result.status.should.equal(403)
            fs.existsSync(path.join(storageDir, 'keep.txt')).should.be.true()
        })
    })
})
