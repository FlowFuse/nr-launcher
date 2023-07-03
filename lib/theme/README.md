# FlowForge Node-RED Theme

A set of custom Node-RED themes used when running inside the FlowForge platform.

## Themes included

* forge-light
* forge-dark

## Development

To modify the theme, edit the appropriate theme `scss` file:

 - `forge-light/forge-light-theme.scss`
 - `forge-dark/forge-dark-theme.scss`
 
Then run the build to regenerate the theme css. This requires the Node-RED source
repository checked out somewhere local:

    npm run build-theme -- --src=/home/example/github/node-red

This will compile the `forge-light` and `forge-dark` theme files.

*NOTE: `/home/example/github/node-red` is an example. Update this to your local src directory*
