# FlowForge Wrapper for Node-RED

Custom launcher to start Node-RED is a loadable set of settings and to capture logs so they can be streamed to the admin app

### Configure

- `--forgeURL` - URL for Forge platform
- `--port` - port to listen on for management interface
- `--team` - FlowForge team id UUID
- `--project` - FlowForge project id UUID
- `--token` - Bearer Token to access Forge platform
- `--nodeRedPath` - path to dir with a `node_modules` directory container a version of Node-RED
- `--no-tcp-in` - inhibit TCP nodes from being servers
- `--no-udp-in` - inhibit UDP nodes from being servers

The following Environment Variables can be used instead of the cmd line args...

`FORGE_URL`, `FORGE_TEAM_ID`, `FORGE_PROJECT_ID`, `FORGE_PROJECT_TOKEN`, `FORGE_NR_PATH`, `FORGE_NR_NO_TCP_IN`, `FORGE_NR_NO_UDP_IN`

NOTE: cmd line args take precedent if both are provided