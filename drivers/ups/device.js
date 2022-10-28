'use strict';

const { Device } = require('homey');
const { parseUPSStatus } = require('../../lib/Utils');
const Nut = require('../../lib/node-nut');

class UPSDevice extends Device {

  nut;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.initNut();

    this.log('UPS device has been initialized');
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');

    const result = await this.nut.GetUPSVars(device.name);

    if (result) {
      const status = parseUPSStatus(result);

      this.log(status);

      this.setCapabilityValue('measure_battery', status.battery)
        .catch(this.error);

      this.setCapabilityValue('measure_temperature', status.battery_temperature)
        .catch(this.error);

      this.setCapabilityValue('alarm_status', status.alarm_status)
        .catch(this.error);

      this.setCapabilityValue('voltage.input', status.input_voltage)
        .catch(this.error);

      this.setCapabilityValue('voltage.output', status.output_voltage)
        .catch(this.error);

      this.setCapabilityValue('battery_runtime', status.battery_runtime)
        .catch(this.error);

      this.setCapabilityValue('status', status.status_readable)
        .catch(this.error);

      this.batteryRuntimeLowerThanTrigger.trigger(this, {}, { runtime: status.battery_runtime })
        .then(() => {
          this.log('Done trigger flow card battery_runtime_lower_than');
        })
        .catch((error) => {
          this.log(`Cannot trigger flow card battery_runtime_lower_than: ${error}`);
        });
    }
  }

  initNut() {
    this.nut = new Nut(parseInt(this.getSetting('port'), 10), this.getSetting('ip'));

    this.nut.on('error', (err) => {
      this.log(`There was an error: ${err}`);
    });

    this.nut.on('close', () => {
      this.log('Connection closed. Starting again..');
      this.nut.start();
    });

    this.nut.start();
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    const { interval } = this;
    for (const name of changedKeys) {
      this.log(`Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`);
    }
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`);
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    const updateInterval = Number(newInterval) * 1000;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    const {
      interval,
      device,
    } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = UPSDevice;