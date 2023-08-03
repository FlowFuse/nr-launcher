#### 1.10.0: Release

 - Ensure TimeZone is passed to NR (#151) @hardillb
 - Fix node_path when running in dev-env (#150) @knolleary
 - Fix wait on deferredStop when trying to start a stopping instance (#147) @knolleary
 - settings: Inject custom catalogues into NR settings (#146) @ZJvandeWeg
 - Chore: Set root flag in eslint (#142) @Pezmc
 - Prevent NODE_RED_ENABLE_PROJECTS (#141) @hardillb
 - Fix theme build step (#139) @hardillb

#### 1.9.0: Release

 - Version bump sub project `nr-theme` for initial (manual) publish (#137) @Steve-Mcl
 - Publish theme as seperate package (#136) @hardillb
 - Add package lock.json (#135) @hardillb
 - Add src attribute to launcher log entries (#133) @hardillb
 - Change oauth scope for httpNode middleware requests (#132) @knolleary
 - Update health poll to use 127.0.0.1 address (#129) @knolleary

#### 1.8.0: Release

 - Update dependencies (#124) @hardillb
 - Pass HA flag to project nodes if enabled (#123) @knolleary
 - Disable the editor if HA enabled (#122) @hardillb
 - Set IPv4 first flag (#120) @hardillb
 - Make NR listen on IPv6 as well as IPv4 (#119) @hardillb
 - Ensure HOME env var set if present (#118) @hardillb
 - Increase number of startup polls allowed to fail for hang detection (#116) @knolleary

#### 1.7.0: Release

 - Allow more failed pings during startup to avoid slow starts getting killed (#113) @knolleary
 - Detect hung node-red via regularly polling (#112) @knolleary
 - Ensure Node-RED process is stopped before attempting restart (#111) @knolleary

#### 1.6.0: Release

 - Resolve theme selection issue (#108) @Steve-Mcl

#### 1.5.0: Release

 - Improve crash loop detection (#106) @Steve-Mcl
 - Allow Private CA Certs bundle to be passed to Node-RED (#105) @hardillb

#### 1.4.0: Release

 - Bump nr-peresistent-context nodes (#103) @hardillb
 - Move storage/auth/auditLogger/theme into launcher (#100) @knolleary

#### 1.3.0: Release

 - Bump project nodes version (#97) @hardillb
 - Separate out Dashboard middleware handling (#96) @knolleary
 - Add auth and storage to node-red nodeDir (#95) @knolleary
 - Improve stuck intermediate state of project (#94) @Steve-Mcl
 - Add Team Library configuration settings (#93) @knolleary
 - Add support for httpNodeMiddleware and FlowForge User auth (#92) @knolleary

#### 1.2.0: Release

 - Bump plugin versions (#90) @hardillb
 - Ensure allow/deny lists default to proper values (#87) @knolleary
 - Add settings for persistent storage (#86) @Steve-Mcl

#### 1.1.0: Release

 - Bump nr-file-node version (#84) @hardillb
 - Add nr-file-nodes as dep (#83) @hardillb
 -  Add fileStore settings for @flowforge/file-storage (#82) @Steve-Mcl
 - Implement tcp/udp allow/inhibit settings (#81) @Steve-Mcl

#### 1.0.0: Release

 - Closes a timing window on slow starting systems (#79) @hardillb
 - Fix npm on windows (#78) @Steve-Mcl
 - Npm install starting (#75) @hardillb
 - Remove unwanted debug (#76) @knolleary
 - Have loadSettings fail gracefully (#74) @hardillb
 - Update eslint (#73) @knolleary
 - Get the list of package.json modules from project settings (#72) @knolleary
 - Back out #70 (#71) @hardillb
 - Remove the explicit paths to theme (#70) @hardillb

#### 0.10.0: Release

 - Only write httpNodeAuth if non-blank user/pass are provided (#67) @knolleary
 - Add flag to disable Node-RED Welcome Tours (#66) @hardillb
 - Allow the setting of httpNodeAuth (#64) @hardillb
 - Improve accuracy of the stopped/running status indicator following a restart (#65) @Steve-Mcl

#### 0.9.0: Release

 - permit custom dashboard path to be set from FF (#62) @Steve-Mcl
 - Add launcherVersion for both front and backend (#61) @Steve-Mcl

#### 0.8.0: Release

 - add runtimeState (#58) @sammachin
 - add dep @flowforge/nr-project-nodes (#56) @Steve-Mcl
 - Add FORGE_LICENSE_TYPE env so launcher can enable EE only features (#59) @knolleary
 - Ensure broker details are passed through to settings file (#57) @knolleary
 - Map through settings for project links (#53) @Steve-Mcl
 - Fix search path for theme (#52) @hardillb

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
