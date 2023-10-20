const fs = require('fs')
const http = require('http')
const path = require('path')
const should = require('should') // eslint-disable-line
const SampleBuffer = require('../../../lib/resources/sampleBuffer')

const promData = fs.readFileSync(path.join(__dirname, '../../prom-data.txt'))

describe('Resource Sampling', function () {
    describe('Wrapping', function () {
        it('Should wrap properly', function () {
            const buffer = new SampleBuffer(20)
            for (let i = 0; i < 30; i++) {
                buffer.add({
                    counter: i
                })
            }
            const sample = buffer.lastX(15)
            sample[1].should.have.property('counter', 16)
        })
    })
    describe('Averaging samples', function () {
        it('Average without wrapping', function () {
            const buffer = new SampleBuffer(20)
            for (let i = 0; i < 10; i++) {
                buffer.add({
                    ps: 128
                })
            }
            const lastX = buffer.lastX(15)
            lastX.should.have.property('length', 10)
            const avg = buffer.avgLastX(5)
            avg.should.have.property('count', 5)
            avg.should.have.property('ps', 128)
        })
        it('Average with wrapping', function () {
            const buffer = new SampleBuffer(20)
            for (let i = 0; i < 30; i++) {
                buffer.add({
                    ps: 128
                })
            }
            const lastX = buffer.lastX(15)
            lastX.should.have.property('length', 15)
            const avg = buffer.avgLastX(5)
            avg.should.have.property('count', 5)
            avg.should.have.property('ps', 128)
        })
    })
    describe('read prometheus data', function () {
        const port = 8080
        let server
        before(function () {
            server = http.createServer(function (req, res) {
                res.writeHead(200, { 'Content-Type': 'text/plain' })
                res.write(promData)
                res.end()
            }).listen(port)
        })

        after(function () {
            server.close()
        })

        const resourceSample = require('../../../lib/resources/sample')

        it('read sample data', async function () {
            const pollUrl = `http://localhost:${port}/ff/metrics`
            const sample = await resourceSample(pollUrl, 5)
            sample.should.have.property('ps', 110.92578125)
            sample.should.not.have.property('cpu')
            const secondSample = await resourceSample(pollUrl, 5)
            secondSample.should.have.property('cpu', 0)
        })
    })
})
