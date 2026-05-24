'use strict';

/**
 * drivers/index.js — KobeOS driver registry
 *
 * Registers all built-in hardware drivers with the DriverManager.
 * This is the canonical driver registry for the new repo layout.
 * The electron/runtime/drivers/index.js re-exports from here.
 */

const CameraDriver    = require('./cameras/camera-driver');
const AudioDriver     = require('./devices/audio-driver');
const BluetoothDriver = require('./devices/bluetooth-driver');
const POSDriver       = require('./payments/pos-driver');
const PaymentDriver   = require('./payments/payment-driver');
const VendingDriver   = require('./vending/vending-driver');

function registerBuiltinDrivers(driverManager) {
  driverManager.register('camera',    new CameraDriver());
  driverManager.register('audio',     new AudioDriver());
  driverManager.register('bluetooth', new BluetoothDriver());
  driverManager.register('pos',       new POSDriver());
  driverManager.register('payment',   new PaymentDriver());
  driverManager.register('vending',   new VendingDriver());
}

module.exports = { registerBuiltinDrivers, CameraDriver, AudioDriver, BluetoothDriver, POSDriver, PaymentDriver, VendingDriver };
