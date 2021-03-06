const express = require('express')
const client = require('prom-client')

/**
 * Creates a new telemetry server.
 * Telemetry probes are not available until {@linkcode TelemetryServer#start} is called.
 * @param {Object} [logger] - Optional logger to use in place of the default console logger.
 * The object should have a key 'info' which is a function that takes a single parameter containing the log message.
 */
class TelemetryServer {
  constructor (logger = { info: console.log }) {
    this._logger = logger
    this._live = true
    this._ready = false
    this._app = express()
    this._app.disable('x-powered-by')
    this._app.get('/liveness', (req, res) => res.status(this._mapToStatusCode(this._live)).end())
    this._app.get('/readiness', (req, res) => res.status(this._mapToStatusCode(this._ready)).end())
    this._app.get('/metrics', async (req, res) => {
      res.set('Content-Type', client.register.contentType)
      res.end(await client.register.metrics())
    })
  }

  /**
   * Calling this indicates the application is available for processing traffic.
   * After calling this the readiness probe will return status code 200 (send traffic).
   * Traffic can be stopped by calling {@linkcode TelemetryServer#signalNotReady}.
   * Metrics will still be available.
   * Tip: Call this as the last step of your application startup code, or if unavailable service dependencies
   * become available again.
   */
  signalReady () {
    this._ready = true
  }

  /**
   * Calling this indicates the application is not available for processing traffic.
   * After calling this the readiness probe will return status code 500 (stop traffic).
   * Note this will *not* cause the application pod to be restarted.
   * Traffic can be resumed by calling {@linkcode TelemetryServer#signalReady}.
   * Metrics will still be available.
   * Tip: Call this as the first step of your application shutdown code, or if your service dependencies
   * become unavailable.
   */
  signalNotReady () {
    this._ready = false
  }

  /**
   * Calling this indicates the application is no longer in a useful state.
   * After calling this the liveness probe will return status code 500 (terminate pod)
   * and the readiness probe will return 500 (stop traffic).
   * Note this will cause the application pod to be terminated.
   * Metrics will still be available until termination.
   * Tip: Call this just before {@linkcode TelemetryServer#stop}
   */
  signalStopped () {
    this._live = false
    this._ready = false
  }

  /**
   * Returns the underlying {@link https://github.com/expressjs/express|Express} object used by the telemetry server.
   * @returns {Express}
   */
  getApp () {
    return this._app
  }

  /**
   * Makes the telemetry probes available on a network port.
   * After calling this the liveness probe will return 200 (alive) and the readiness probe will return 500 (stop traffic).
   * The metrics probe will return all available metrics.
   * Tip: Call this as soon as possible in your application startup code.
   * @param {Number} telemetryPort the network port the probes should be available on.
   * @returns {TelemetryServer} Returns 'this' for convenience in calling other methods.
   */
  start (telemetryPort) {
    if (this._server) {
      throw new Error('Service telemetry already started')
    }

    this._logger.info('Service telemetry starting...')
    this._server = this.getApp().listen(telemetryPort, () => {
      this._logger.info(`Service telemetry is up on ${telemetryPort}`)
    })
    return this
  }

  /**
   * Withdraws the telemetry probes.
   * Tip: Call this as the last step in the shutdown code of your application.
   */
  stop () {
    if (!this._server) {
      throw new Error('Service telemetry not started')
    }

    this._logger.info('Service telemetry stopping...')
    this._server.close(() => {
      this._logger.info('Service telemetry is stopped')
    })
  }

  _mapToStatusCode (state) {
    return state ? 200 : 500
  }
}

module.exports = TelemetryServer
