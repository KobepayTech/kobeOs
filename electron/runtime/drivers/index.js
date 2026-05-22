'use strict';

/**
 * Shim — re-exports from the canonical driver registry at drivers/index.js.
 * Keeps the Electron build working while the repo uses the new layout.
 */
module.exports = require('../../../drivers/index');
