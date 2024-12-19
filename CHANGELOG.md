#### 2.12.0: Release

 - Bump flowfuse/github-actions-workflows from 0.37.0 to 0.38.0 (#305)
 - Update nr-file-nodes (#313) @hardillb
 - Add Dashboard v2 max upload size (#310) @hardillb
 - include crash detail in audit log transmission (#312) @Steve-Mcl
 - Add "disable auto safe mode" option (#309) @Steve-Mcl
 - Ensure restart on done only a running NR instance (#304) @hardillb
 - Bump express version (#307) @hardillb
 - Allow Dashboards to be loaded in an iFrame (#306) @hardillb
 - Add user to flow storage (#287) @hardillb

#### 2.11.0: Release

 - Bump flowfuse/github-actions-workflows from 0.36.0 to 0.37.0 (#301)
 - Pass through team-broker flag to instance settings (#302) @knolleary

#### 2.10.0: Release

 - Bump flowfuse/github-actions-workflows from 0.34.0 to 0.36.0 (#296)
 - Bump flowfuse/github-actions-workflows from 0.33.0 to 0.34.0 (#294)
 - Bump flowfuse/github-actions-workflows from 0.30.0 to 0.33.0 (#293)
 - Update project nodes to latest (#298) @Steve-Mcl
 - Bump cookie, express, express-session and light-my-request (#295) @app/dependabot

#### 2.9.0: Release

 - Bump flowfuse/github-actions-workflows from 0.29.0 to 0.30.0 (#289) @dependabot
 - intercept logout click and emit logout event when editor is embedded (#288) @cstns
 - Ensure auth middleware applied on httpStatic routes (#286) @knolleary
 - Bump express to 4.21.0 to pick dependencies (#283) @hardillb
 - Bump flowfuse/github-actions-workflows from 0.28.0 to 0.29.0 (#282) @dependabot
 - Bump flowfuse/github-actions-workflows from 0.19.0 to 0.28.0 (#281) @dependabot

#### 2.8.0: Release

 - Update Project Nodes and File nodes (#279) @hardillb
 - First pass at file api (#275) @hardillb
 - Fix HealthCheck errors when editor disabled (#277) @hardillb
 - Fix flushInterval in context module (#272) @knolleary

#### 2.7.0: Release

 - Bump dependencies in preparation for release 2.7.0 (#270) @Steve-Mcl
 - Wrap unguarded HTTP requests in try/catch (#267) @hardillb
 - nr-launcher was not catching console.error output (#269) @hardillb
 - Bump tibdex/github-app-token from 1 to 2 (#236) @app/dependabot
 - Bump ws from 7.5.9 to 8.18.0 (#265) @app/dependabot
 - Bump ws from 8.14.1 to 8.17.1 (#251) @app/dependabot
 - Add support for UIBuilder using storage (#263) @hardillb
 - Update release-publish to nodejs 18 (#264) @hardillb
 - Bump JS-DevTools/npm-publish from 2 to 3 (#234) @app/dependabot

#### 2.6.0: Release

 - Set CWD to storage dir (#250) @hardillb
 - ci: Add `nr-assistant` dependency to `build and push` workflow (#260) @ppawlowski
 - Map runtime settings for nr-assistant (#256) @Steve-Mcl
 - Fix tests and linting (#258) @Steve-Mcl
 - Set secure cookie options (#254) @knolleary
 - Bump braces from 3.0.2 to 3.0.3 (#247) @app/dependabot
 - ci: Bump build_node_package workflow to 0.14.0 (#248) @ppawlowski

#### 2.5.1: Release

 - Generate absolute callback url ourselves (#245) @knolleary
 - Revert httpAdminCookieOptions (#243) @knolleary

#### 2.5.0: Release

 - Fix settings file (#241) @knolleary
 - Add CSP headers (#230) @cstns
 - Fix auth handling when editor moved from default path (#240) @knolleary
 - Bump actions/setup-node from 1 to 4 (#238) @app/dependabot
 - Bump actions/checkout from 1 to 4 (#235) @app/dependabot
 - Enable dependabot for github actions (#233) @ppawlowski
 - Make the oauth callback URL relative (#232) @hardillb

#### 2.4.0: Release

 - User defined health check interval (#228) @Steve-Mcl
 - Replace url paths that were pointing to deprecated FF endpoints (#229) @cstns
 - Allow the parent window to configure and manage navigation requests (#224) @cstns
 - Add shell option to npm spawn command (#226) @knolleary

#### 2.3.0: Release


#### 2.2.2: Release

 - Enable multiplayer by default (#221) @knolleary
 - Bump express from 4.18.2 to 4.19.2 (#220) @app/dependabot
 - Log exit code and signal if npm errors (#219) @hardillb

#### 2.2.1: Release

 - Add apiMaxLength & debugMaxLength settings (#217) @hardillb

#### 2.2.0: Release

 - Provide better health check message when waiting for NR to start (#215) @knolleary
 - Bump jsonata and @node-red/util (#214) @app/dependabot
 - Http node auth token (#212) @hardillb

#### 2.1.1: Release

 - Handle httpAdminRoot being moved away from / (#210) @knolleary
 - Bump ip from 2.0.0 to 2.0.1 (#209) @app/dependabot

#### 2.1.0: Release

 - Log passthrough (#207) @hardillb

#### 2.0.1: Release

 - Run npm install with instance env vars (#204) @hardillb

#### 2.0.0: Release

 - Remove console.log (#202) @hardillb

#### 1.15.0: Release


#### 1.14.0: Release

 - Bump project nodes to 0.6.1 release (#198) @knolleary
 - Bump project nodes version (#197) @knolleary
 - Migrate to @flowfuse npm scope (#196) @knolleary
 - Fix Node-RED src path for automation build (#193) @Steve-Mcl

#### 1.13.3: Release
 - Update path to localfs following org rename (#191) @Steve-Mcl
 - Update file nodes to latest (#189) @knolleary
 - Expose user email in session (#188) @hardillb

#### 1.13.0: Release

 - Fixes node path for k8s/docker environments (#186) @knolleary
 - FIX: Dispatch node-red image rebuild after successful package publish (#185) @ppawlowski
 - Update project nodes for new org (#183) @knolleary
 - Pin reusable workflows to v0.1.0 (#184) @ppawlowski
 - Update to use @flowfuse/nr-file-nodes (#182) @knolleary
 - Remove unused workflow (#181) @knolleary
 - Bump build and publish workflow versions (#180) @ppawlowski
 - Move nr-persistent-context into nr-launcher (#179) @knolleary
 - Add tests and fix error samples (#178) @hardillb
 - Resource monitoring and alerts (#176) @hardillb
 - Update branding in theme menu items (#177) @knolleary
 - Update ff references in package.json (#174) @knolleary
 - Change repo references in workflows after github org rename (#169) @ppawlowski

#### 1.12.0: Release

 - Fix tests on windows - ensure forward slashes on paths (#172) @Steve-Mcl
 - Bumping version (#170) @hardillb
 - Add support for custom node catalogues (#162) @hardillb
 - Publish nightly package to npmjs (#168) @ppawlowski

#### 1.11.0: Release

 - Use feature flag to enable shared library (#156) @knolleary
 - Enable localfs package build dispatcher after package publish (#160) @ppawlowski
 - Update icon (#158) @Yndira-FlowForge
 - FIX: Publish package on push to `main` and on schedule (#155) @ppawlowski
 - Enable tests on build; refactor `ignore-scripts` approach (#154) @ppawlowski
 - Introduce publish pipeline (#143) @ppawlowski

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
