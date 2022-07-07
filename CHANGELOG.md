#### 0.7.0: Release

 - Add some initial tests (#49) @knolleary
 - Remove Node-RED as a direct dependency (#48) @hardillb
 - Fix node denyList and set up module denyList (#46) @hardillb
 - Initial theming support (#37) @Steve-Mcl
 - Add "trust proxy" to settings.js to improve client IP detection (#45) @Steve-Mcl

#### 0.6.0: Release

 - Map FlowForge logout to nodered auth/revoke (#40) @Steve-Mcl
 - Update dependencies (#41) @knolleary
 - Report node/nr/launcher versions in /info endpoint response (#39) @knolleary
 - Fix win32 stopping projects and "crash" status (#38) @Steve-Mcl
 - Auto generate credential secret for NR project to remove warnings in log (#36) @Steve-Mcl

#### 0.5.0: Release

 - Redirect user back to ff platform on logout (#34) @knolleary
 - Add palette/module allowList/denyList (#32) @hardillb
 - Put NR into safemode when crash loop detected (#33) @knolleary

#### 0.4.0: Release

 - Update project automation (#28) @knolleary
 - Remove unused logBuffer code (#27) @knolleary
 - Fix lint rules to apply to lib dir (#26) @hardillb

#### 0.3.0: Release

 - Apply project settings to settings.js (#23) @knolleary
 - Use a specific NR version (#22) @hardillb
 - Add eslint rules (#21) @hardillb
 - Add support for max-old-space-size (#20) @knolleary
 - Add launcher's node_modules to NR NODE_PATH (#19) @hardillb
 - Automate npm publish on release (#18) @hardillb

#### 0.2.0: Release

 - Set default editor to monaco (#15) @hardillb
 - Add project workflow automation (#14) @knolleary
