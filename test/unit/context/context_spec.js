const should = require('should')
const util = require('util')
const setup = require('./setup')
const FFContextPlugin = require('@flowfuse/nr-launcher/context')

// common settings
const FORGE_TEAM_ID = 'test-team-1'
const FORGE_PROJECT_ID = 'test-project-1'
const FORGE_STORAGE_TOKEN = 'test-token-1'
const FORGE_STORAGE_URL = 'http://127.0.0.1:3001'
// file/context server settings
const fileServerHost = '0.0.0.0'
const fileServerPort = 3001
const fileServerContext = { type: 'sequelize', quota: 1000, options: { type: 'sqlite', storage: 'ff-context-test.db' } }
const fileServerBaseUrl = 'http://127.0.0.1:3002' // URL to FF App
// app (and auth) server settings
const authHost = '0.0.0.0'
const authPort = 3002

describe('Context Plugin', async function () {
    this.timeout(4000)
    // server instances
    let flowforgeApp
    let fileServerApp

    before(async function () {
        flowforgeApp = setup.authServer({
            host: authHost,
            port: authPort,
            authConfig: [
                { token: FORGE_STORAGE_TOKEN, projectId: FORGE_PROJECT_ID }
            ]
        })
        fileServerApp = await setup.setupFileServerApp({
            teamId: FORGE_TEAM_ID,
            projectId: FORGE_PROJECT_ID,
            token: FORGE_STORAGE_TOKEN,
            host: fileServerHost,
            port: fileServerPort,
            base_url: fileServerBaseUrl,
            context: fileServerContext
        })
        // sleep a while to allow file server to start
        await new Promise(resolve => setTimeout(resolve, 750))
    })

    after(async function () {
        if (fileServerApp) {
            await fileServerApp.close()
            fileServerApp = null
        }

        const closeFlowforgeApp = util.promisify(flowforgeApp.close).bind(flowforgeApp)
        await closeFlowforgeApp()
        flowforgeApp = null
    })

    describe('Context Plugin with cache', async function () {
        /** @type {FFContextStorage} */
        let plugin = {}
        let setContext = plugin.set
        let getContext = plugin.get
        let keysContext = plugin.keys
        let setContextSync = plugin.set
        let getContextSync = plugin.get
        let keysContextSync = plugin.keys

        before(async function () {
            plugin = FFContextPlugin({
                projectID: FORGE_PROJECT_ID,
                token: FORGE_STORAGE_TOKEN,
                url: FORGE_STORAGE_URL,
                cache: true,
                pageSize: 2,
                flushInterval: 2,
                requestTimeout: 1500
            })
            setContext = util.promisify(plugin.set).bind(plugin)
            getContext = util.promisify(plugin.get).bind(plugin)
            keysContext = util.promisify(plugin.keys).bind(plugin)
            setContextSync = plugin.set.bind(plugin)
            getContextSync = plugin.get.bind(plugin)
            keysContextSync = plugin.keys.bind(plugin)
        })

        describe('Basic set and get values in context', async function () {
            it('should set and get simple values in flow context', async function () {
                const contextVariable = 'test1'
                const contextValue = 'test1value'
                const contextScope = 'flow-1'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in global context', async function () {
                const contextVariable = 'test2'
                const contextValue = 'test2value'
                const contextScope = 'global'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in node context', async function () {
                const contextVariable = 'test3'
                const contextValue = 'test3value'
                const contextScope = 'a-node-id:a-flow-id'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in flow context (sync)', async function () {
                const contextVariable = 'test1'
                const contextValue = 'test1value'
                const contextScope = 'flow-1'
                setContextSync(contextScope, contextVariable, contextValue)
                const result = getContextSync(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in global context (sync)', async function () {
                const contextVariable = 'test2'
                const contextValue = 'test2value'
                const contextScope = 'global'
                setContextSync(contextScope, contextVariable, contextValue)
                const result = getContextSync(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in node context (sync)', async function () {
                const contextVariable = 'test3'
                const contextValue = 'test3value'
                const contextScope = 'a-node-id:a-flow-id'
                setContextSync(contextScope, contextVariable, contextValue)
                const result = getContextSync(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
        })

        describe('Clean context', async function () {
            it('should remove all context except global scope', async function () {
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('global', 'global-var-1', 'global-value-1')
                await plugin.clean()

                // node and flow context should be removed
                const nc = await getContext('node-1:flow-1', 'node-1-var-1')
                const nc2 = await getContext('node-2:flow-1', 'node-2-var-1')
                const fc = await getContext('flow-1', 'flow-var-1')
                should(nc).be.undefined()
                should(nc2).be.undefined()
                should(fc).be.undefined()

                // global context should not be removed
                const gc = await getContext('global', 'global-var-1')
                should(gc).be.not.undefined()
            })
        })

        describe('Access nested properties', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should get full object from top level of flow context', async function () {
                const result = await getContext('flow-1', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get full object from top level of global context', async function () {
                const result = await getContext('global', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get full object from top level of node context', async function () {
                const result = await getContext('node-1:flow-1', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get a nested integer value from an object', async function () {
                const result = await getContext('node-1:flow-1', 'nested.integer1')
                should(result).be.equal(nested.integer1)
            })
            it('should get a nested string value from an object', async function () {
                const result = await getContext('flow-1', 'nested.string1')
                should(result).be.equal(nested.string1)
            })
            it('should get a nested buffer value from an object', async function () {
                const result = await getContext('global', 'nested.buffer1')
                result.should.be.an.Object()
                if (Buffer.isBuffer(result)) {
                    should(result.toString()).be.equal(nested.buffer1.toString())
                } else {
                    result.should.have.property('type')
                    result.should.have.property('data')
                    const buf = Buffer.from(result.data)
                    should(buf.toString()).be.equal(nested.buffer1.toString())
                }
            })
            it('should get nested value from an object', async function () {
                const result = await getContext('node-1:flow-1', 'nested.obj1.prop1')
                should(result).be.equal(nested.obj1.prop1)
            })
            it('should get nested value from an array', async function () {
                const result = await getContext('flow-1', 'nested.arr1[2]')
                should(result).be.equal(nested.arr1[2])
            })
            it('should get nested value from an nested object', async function () {
                const result = await getContext('global', 'nested.nested2.nested3.nested4')
                should(result).be.equal(nested.nested2.nested3.nested4)
            })
        })

        describe('Set nested properties in context', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should set nested property on non existing object in flow scope', async function () {
                await setContext('flow-1', 'newFlowVar.newFlowVar2', 'newFlowVar2 value')
                const result = await getContext('flow-1', 'newFlowVar')
                result.should.deepEqual({ newFlowVar2: 'newFlowVar2 value' })
            })
            it('should set nested property on non existing object in global scope', async function () {
                await setContext('global', 'newGlobalVar.newGlobalVar2', 'newGlobalVar2 value')
                const result = await getContext('global', 'newGlobalVar')
                result.should.deepEqual({ newGlobalVar2: 'newGlobalVar2 value' })
            })
            it('should set nested property on non existing object in node scope', async function () {
                await setContext('node-1:flow-1', 'new-node-1-var.new-node-1-var2', 'new-node-1-var2 value')
                const result = await getContext('node-1:flow-1', 'new-node-1-var')
                result.should.deepEqual({ 'new-node-1-var2': 'new-node-1-var2 value' })
            })
            it('should set a nested value on an existing nested object in flow scope', async function () {
                await setContext('flow-1', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('flow-1', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
            it('should set a nested value on an existing nested object in global scope', async function () {
                await setContext('global', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('global', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
            it('should set a nested value on an existing nested object in node scope', async function () {
                await setContext('node-1:flow-1', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('node-1:flow-1', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
        })

        describe('Delete context entries', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should delete top level context item in flow scope', async function () {
                await setContext('flow-1', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.undefined()
                should(await getContext('global', 'nested')).be.an.Object()
                should(await getContext('node-1:flow-1', 'nested')).be.an.Object()
            })
            it('should delete top level context item in global scope', async function () {
                await setContext('global', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.an.Object()
                should(await getContext('global', 'nested')).be.undefined()
                should(await getContext('node-1:flow-1', 'nested')).be.an.Object()
            })
            it('should delete top level context item in node scope', async function () {
                await setContext('node-1:flow-1', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.an.Object()
                should(await getContext('global', 'nested')).be.an.Object()
                should(await getContext('node-1:flow-1', 'nested')).be.undefined()
            })
            it('should delete nested context item in flow scope', async function () {
                await setContext('flow-1', 'nested.nested2.nested3', undefined)
                const result = await getContext('flow-1', 'nested')
                result.should.have.a.property('nested2', {})
            })
            it('should delete nested context item in global scope', async function () {
                await setContext('global', 'nested.nested2.nested3', undefined)
                const result = await getContext('global', 'nested')
                result.should.have.a.property('nested2', {})
            })
            it('should delete nested context item in node scope', async function () {
                await setContext('node-1:flow-1', 'nested.nested2.nested3', undefined)
                const result = await getContext('node-1:flow-1', 'nested')
                result.should.have.a.property('nested2', {})
            })
        })

        describe('Get Keys', async function () {
            before(async function () {
                await plugin.clean()
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-1:flow-1', 'node-1-var-2', 'node-1-value-2')
                await setContext('node-1:flow-1', 'node-1-var-3', 'node-1-value-3')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('node-2:flow-1', 'node-2-var-2', 'node-2-value-2')
                await setContext('node-2:flow-1', 'node-2-var-3', 'node-2-value-3')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('flow-1', 'flow-var-2', 'flow-value-2')
                await setContext('flow-1', 'flow-var-3', 'flow-value-3')
                await setContext('global', 'global-var-1', 'global-value-1')
                await setContext('global', 'global-var-2', 'global-value-2')
                await setContext('global', 'global-var-3', 'global-value-3')
            })
            it('should get keys for flow scope', async function () {
                const result = await keysContext('flow-1')
                should(result).deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
            })
            it('should get keys for global scope', async function () {
                const result = await keysContext('global')
                // note, others tests may have populated global context
                // and the clean() in the `before` hook does not remove them
                // so we need to check that the keys we expect are there
                should(result).be.an.Array()
                result.should.containEql('global-var-1')
                result.should.containEql('global-var-2')
                result.should.containEql('global-var-3')
            })
            it('should get keys for node scope: node-1', async function () {
                const result = await keysContext('node-1:flow-1')
                should(result).deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
            })
            it('should get keys for node scope: node-2', async function () {
                const result = await keysContext('node-2:flow-1')
                should(result).deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
            })
            it('should get keys for flow scope (sync)', async function () {
                const result = keysContextSync('flow-1')
                should(result).deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
            })
            it('should get keys for global scope (sync)', async function () {
                const result = keysContextSync('global')
                // note, others tests may have populated global context
                // and the clean() in the `before` hook does not remove them
                // so we need to check that the keys we expect are there
                should(result).be.an.Array()
                result.should.containEql('global-var-1')
                result.should.containEql('global-var-2')
                result.should.containEql('global-var-3')
            })
            it('should get keys for node scope: node-1 (sync)', async function () {
                const result = keysContextSync('node-1:flow-1')
                should(result).deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
            })
            it('should get keys for node scope: node-2 (sync)', async function () {
                const result = keysContextSync('node-2:flow-1')
                should(result).deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
            })
        })

        describe('Delete Scope', async function () {
            beforeEach(async function () {
                await plugin.clean()
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-1:flow-1', 'node-1-var-2', 'node-1-value-2')
                await setContext('node-1:flow-1', 'node-1-var-3', 'node-1-value-3')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('node-2:flow-1', 'node-2-var-2', 'node-2-value-2')
                await setContext('node-2:flow-1', 'node-2-var-3', 'node-2-value-3')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('flow-1', 'flow-var-2', 'flow-value-2')
                await setContext('flow-1', 'flow-var-3', 'flow-value-3')
                await setContext('global', 'global-var-1', 'global-value-1')
                await setContext('global', 'global-var-2', 'global-value-2')
                await setContext('global', 'global-var-3', 'global-value-3')
            })
            it('should delete global scope', async function () {
                await plugin.delete('global')
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual([])
                // ensure other scopes are not affected
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
            })
            it('should delete flow scope only', async function () {
                await plugin.delete('flow-1')
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual([])
                // ensure other scopes are not affected
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual(['global-var-1', 'global-var-2', 'global-var-3'])
            })
            it('should delete node-1 scope only', async function () {
                await plugin.delete('node-1:flow-1')
                // ensure node-1 scope is empty
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual([])

                // ensure other scopes are not affected
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual(['global-var-1', 'global-var-2', 'global-var-3'])
            })
        })
    })

    describe('Context Plugin without cache', async function () {
        /** @type {FFContextStorage} */
        let plugin = {}
        let setContext = plugin.set
        let getContext = plugin.get
        let keysContext = plugin.keys

        before(async function () {
            plugin = FFContextPlugin({
                projectID: FORGE_PROJECT_ID,
                token: FORGE_STORAGE_TOKEN,
                url: FORGE_STORAGE_URL,
                cache: false,
                pageSize: 2,
                flushInterval: 2,
                requestTimeout: 11500
            })
            setContext = util.promisify(plugin.set).bind(plugin)
            getContext = util.promisify(plugin.get).bind(plugin)
            keysContext = util.promisify(plugin.keys).bind(plugin)
        })

        describe('Basic set and get values in context', async function () {
            it('should set and get simple values in flow context', async function () {
                const contextVariable = 'test1'
                const contextValue = 'test1value'
                const contextScope = 'flow-1'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in global context', async function () {
                const contextVariable = 'test2'
                const contextValue = 'test2value'
                const contextScope = 'global'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
            it('should set and get simple values in node context', async function () {
                const contextVariable = 'test3'
                const contextValue = 'test3value'
                const contextScope = 'a-node-id:a-flow-id'
                await setContext(contextScope, contextVariable, contextValue)
                const result = await getContext(contextScope, contextVariable)
                should(result).be.equal(contextValue)
            })
        })

        describe('Clean context', async function () {
            it('should remove all context except global scope', async function () {
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('global', 'global-var-1', 'global-value-1')
                await plugin.clean()

                // node and flow context should be removed
                const nc = await getContext('node-1:flow-1', 'node-1-var-1')
                const nc2 = await getContext('node-2:flow-1', 'node-2-var-1')
                const fc = await getContext('flow-1', 'flow-var-1')
                should(nc).be.undefined()
                should(nc2).be.undefined()
                should(fc).be.undefined()

                // global context should not be removed
                const gc = await getContext('global', 'global-var-1')
                should(gc).be.not.undefined()
            })
        })

        describe('Access nested properties', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should get full object from top level of flow context', async function () {
                const result = await getContext('flow-1', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get full object from top level of global context', async function () {
                const result = await getContext('global', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get full object from top level of node context', async function () {
                const result = await getContext('node-1:flow-1', 'nested')
                should(result).be.an.Object()
                const nestedStringified = JSON.stringify(nested)
                const resultStringified = JSON.stringify(result)
                should(resultStringified).be.equal(nestedStringified)
            })
            it('should get a nested integer value from an object', async function () {
                const result = await getContext('node-1:flow-1', 'nested.integer1')
                should(result).be.equal(nested.integer1)
            })
            it('should get a nested string value from an object', async function () {
                const result = await getContext('flow-1', 'nested.string1')
                should(result).be.equal(nested.string1)
            })
            it('should get a nested buffer value from an object', async function () {
                const result = await getContext('global', 'nested.buffer1')
                result.should.be.an.Object()
                if (Buffer.isBuffer(result)) {
                    should(result.toString()).be.equal(nested.buffer1.toString())
                } else {
                    result.should.have.property('type')
                    result.should.have.property('data')
                    const buf = Buffer.from(result.data)
                    should(buf.toString()).be.equal(nested.buffer1.toString())
                }
            })
            it('should get nested value from an object', async function () {
                const result = await getContext('node-1:flow-1', 'nested.obj1.prop1')
                should(result).be.equal(nested.obj1.prop1)
            })
            it('should get nested value from an array', async function () {
                const result = await getContext('flow-1', 'nested.arr1[2]')
                should(result).be.equal(nested.arr1[2])
            })
            it('should get nested value from an nested object', async function () {
                const result = await getContext('global', 'nested.nested2.nested3.nested4')
                should(result).be.equal(nested.nested2.nested3.nested4)
            })
        })

        describe('Set nested properties in context', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should set nested property on non existing object in flow scope', async function () {
                await setContext('flow-1', 'newFlowVar.newFlowVar2', 'newFlowVar2 value')
                const result = await getContext('flow-1', 'newFlowVar')
                result.should.deepEqual({ newFlowVar2: 'newFlowVar2 value' })
            })
            it('should set nested property on non existing object in global scope', async function () {
                await setContext('global', 'newGlobalVar.newGlobalVar2', 'newGlobalVar2 value')
                const result = await getContext('global', 'newGlobalVar')
                result.should.deepEqual({ newGlobalVar2: 'newGlobalVar2 value' })
            })
            it('should set nested property on non existing object in node scope', async function () {
                await setContext('node-1:flow-1', 'new-node-1-var.new-node-1-var2', 'new-node-1-var2 value')
                const result = await getContext('node-1:flow-1', 'new-node-1-var')
                result.should.deepEqual({ 'new-node-1-var2': 'new-node-1-var2 value' })
            })
            it('should set a nested value on an existing nested object in flow scope', async function () {
                await setContext('flow-1', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('flow-1', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
            it('should set a nested value on an existing nested object in global scope', async function () {
                await setContext('global', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('global', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
            it('should set a nested value on an existing nested object in node scope', async function () {
                await setContext('node-1:flow-1', 'nested.nested2.nested3.nested4b', 'nested4b value')
                const result = await getContext('node-1:flow-1', 'nested.nested2.nested3')
                result.should.deepEqual({ nested4: 'nested4 value', nested4b: 'nested4b value' })
            })
        })

        describe('Delete context entries', async function () {
            const nested = {
                obj1: { prop1: 1 },
                arr1: [11, 22, 33],
                integer1: 111,
                string1: 'string1 value',
                buffer1: Buffer.from('buffer1 value'),
                nested2: { nested3: { nested4: 'nested4 value' } }
            }
            beforeEach(async function () {
                await plugin.clean()
                await setContext('flow-1', 'nested', nested)
                await setContext('global', 'nested', nested)
                await setContext('node-1:flow-1', 'nested', nested)
            })
            it('should delete top level context item in flow scope', async function () {
                await setContext('flow-1', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.undefined()
                should(await getContext('global', 'nested')).be.an.Object()
                should(await getContext('node-1:flow-1', 'nested')).be.an.Object()
            })
            it('should delete top level context item in global scope', async function () {
                await setContext('global', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.an.Object()
                should(await getContext('global', 'nested')).be.undefined()
                should(await getContext('node-1:flow-1', 'nested')).be.an.Object()
            })
            it('should delete top level context item in node scope', async function () {
                await setContext('node-1:flow-1', 'nested', undefined)
                should(await getContext('flow-1', 'nested')).be.an.Object()
                should(await getContext('global', 'nested')).be.an.Object()
                should(await getContext('node-1:flow-1', 'nested')).be.undefined()
            })
            it('should delete nested context item in flow scope', async function () {
                await setContext('flow-1', 'nested.nested2.nested3', undefined)
                const result = await getContext('flow-1', 'nested')
                result.should.have.a.property('nested2', {})
            })
            it('should delete nested context item in global scope', async function () {
                await setContext('global', 'nested.nested2.nested3', undefined)
                const result = await getContext('global', 'nested')
                result.should.have.a.property('nested2', {})
            })
            it('should delete nested context item in node scope', async function () {
                await setContext('node-1:flow-1', 'nested.nested2.nested3', undefined)
                const result = await getContext('node-1:flow-1', 'nested')
                result.should.have.a.property('nested2', {})
            })
        })

        describe('Get Keys', async function () {
            before(async function () {
                await plugin.clean()
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-1:flow-1', 'node-1-var-2', 'node-1-value-2')
                await setContext('node-1:flow-1', 'node-1-var-3', 'node-1-value-3')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('node-2:flow-1', 'node-2-var-2', 'node-2-value-2')
                await setContext('node-2:flow-1', 'node-2-var-3', 'node-2-value-3')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('flow-1', 'flow-var-2', 'flow-value-2')
                await setContext('flow-1', 'flow-var-3', 'flow-value-3')
                await setContext('global', 'global-var-1', 'global-value-1')
                await setContext('global', 'global-var-2', 'global-value-2')
                await setContext('global', 'global-var-3', 'global-value-3')
            })
            it('should get keys for flow scope', async function () {
                const result = await keysContext('flow-1')
                should(result).deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
            })
            it('should get keys for global scope', async function () {
                const result = await keysContext('global')
                // note, others tests may have populated global context
                // and the clean() in the `before` hook does not remove them
                // so we need to check that the keys we expect are there
                should(result).be.an.Array()
                result.should.containEql('global-var-1')
                result.should.containEql('global-var-2')
                result.should.containEql('global-var-3')
            })
            it('should get keys for node scope: node-1', async function () {
                const result = await keysContext('node-1:flow-1')
                should(result).deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
            })
            it('should get keys for node scope: node-2', async function () {
                const result = await keysContext('node-2:flow-1')
                should(result).deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
            })
        })

        describe('Delete Scope', async function () {
            beforeEach(async function () {
                await plugin.clean()
                await setContext('node-1:flow-1', 'node-1-var-1', 'node-1-value-1')
                await setContext('node-1:flow-1', 'node-1-var-2', 'node-1-value-2')
                await setContext('node-1:flow-1', 'node-1-var-3', 'node-1-value-3')
                await setContext('node-2:flow-1', 'node-2-var-1', 'node-2-value-1')
                await setContext('node-2:flow-1', 'node-2-var-2', 'node-2-value-2')
                await setContext('node-2:flow-1', 'node-2-var-3', 'node-2-value-3')
                await setContext('flow-1', 'flow-var-1', 'flow-value-1')
                await setContext('flow-1', 'flow-var-2', 'flow-value-2')
                await setContext('flow-1', 'flow-var-3', 'flow-value-3')
                await setContext('global', 'global-var-1', 'global-value-1')
                await setContext('global', 'global-var-2', 'global-value-2')
                await setContext('global', 'global-var-3', 'global-value-3')
            })
            it('should delete global scope', async function () {
                await plugin.delete('global')
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual([])
                // ensure other scopes are not affected
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
            })
            it('should delete flow scope only', async function () {
                await plugin.delete('flow-1')
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual([])
                // ensure other scopes are not affected
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual(['node-1-var-1', 'node-1-var-2', 'node-1-var-3'])
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual(['global-var-1', 'global-var-2', 'global-var-3'])
            })
            it('should delete node-1 scope only', async function () {
                await plugin.delete('node-1:flow-1')
                // ensure node-1 scope is empty
                const node1Keys = await keysContext('node-1:flow-1')
                node1Keys.should.deepEqual([])

                // ensure other scopes are not affected
                const node2Keys = await keysContext('node-2:flow-1')
                node2Keys.should.deepEqual(['node-2-var-1', 'node-2-var-2', 'node-2-var-3'])
                const flowKeys = await keysContext('flow-1')
                flowKeys.should.deepEqual(['flow-var-1', 'flow-var-2', 'flow-var-3'])
                const globalKeys = await keysContext('global')
                globalKeys.should.deepEqual(['global-var-1', 'global-var-2', 'global-var-3'])
            })
        })
    })
})
