const got = require('got')
let pptf
(async function () {
    try {
        pptf = (await import('parse-prometheus-text-format')).default
    } catch (err) {
        console.log(err)
    }
})();


let lastCPUTime = 0

async function sampleResources (url, time) {
    const response = {}
    try {
        const res  = await got.get(url, {
            headers: {
                pragma: 'no-cache',
                'Cache-Control': 'max-age=0, must-revalidate, no-cache'
            },
            timeout: { request: 2000 },
            retry: { limit: 0 }
        })
        const parsed = pptf(res.body)
        parsed.forEach(metric => {
            if (metric.name === 'nodejs_heap_space_size_total_bytes') {
                metric.metrics.forEach(v => {
                    response.hs = parseInt(v.value)
                })
            } else if (metric.name === 'nodejs_heap_space_size_used_bytes') {
                metric.metrics.forEach(v => {
                    response.hu = parseInt(v.value)
                })
            } else if (metric.name === 'process_resident_memory_bytes') {
                response.ps = parseInt(metric.metrics[0].value)/(1024*1024)
            } else if (metric.name === 'process_cpu_seconds_total') {
                cpuTime = parseFloat(metric.metrics[0].value)
                if (lastCPUTime != 0) {
                    const delta = cpuTime - lastCPUTime
                    response.cpu = (delta/time) * 100
                }
                lastCPUTime = cpuTime
            } else if (metric.name === 'nodejs_eventloop_lag_mean_seconds') {
                response.ela = parseFloat(metric.metrics[0].value)
            } else if (metric.name === 'nodejs_eventloop_lag_p99_seconds') {
                response.el99 = parseFloat(metric.metrics[0].value)
            }
        })
    } catch (err) {
        response.err = err.message
    }

    return response
}

module.exports = sampleResources