# FlowForge Wrapper for Node-RED

Custom laucher to start Node-RED is a loadale set of settings and to capture logs so they can be streamed to the admin app

### Configure

- --forgeURL URL for Forge platform
- --port port to listen on for management interface
- --project FlowForge project id UUID
- --token Bearer Token to access Forge platfrom

FORGE_URL, FORGE_PROJECT_ID & FORGE_PROJECT_TOKEN and be used as env vars instead of the cmd line args if not set (cmd line args take preceident)