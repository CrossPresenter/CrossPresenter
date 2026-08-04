const path = require('path');

// Add the Release directory to PATH so Windows can find Processing.NDI.Lib.x64.dll
// This must happen BEFORE requiring the native .node addon
const releaseDir = path.join(__dirname, 'build', 'Release');
process.env.PATH = releaseDir + path.delimiter + (process.env.PATH || '');

// Require the built native addon
const addon = require(path.join(releaseDir, 'ndi_sender.node'));

module.exports = addon;
