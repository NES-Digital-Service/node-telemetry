const express = require('express')
const client = require('prom-client')

/**
 * Creates a new telemetry server.
 * Telemetry endpoints are not available until {@linkcode TelemetryServer#start} is called.
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

  signalReady () {
    this._ready = true
  }

  signalNotReady () {
    this._ready = false
  }

  signalStopped () {
    this._live = false
    this._ready = false
  }

  getApp () {
    return this._app
  }

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
