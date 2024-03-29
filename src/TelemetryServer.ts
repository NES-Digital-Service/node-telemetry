import express, { Application, Request, Response } from 'express'
import { Server } from 'node:http'
import { register } from 'prom-client'

interface Logger {
  info: (arg0: string) => void
}

/**
 * Creates a new telemetry server.
 * Telemetry probes are not available until {@linkcode TelemetryServer#start} is called.
 * @param {Object} [logger] - Optional logger to use in place of the default console logger.
 * The object should have a key 'info' which is a function that takes a single parameter containing the log message.
 */
export default class TelemetryServer {
  #live: boolean
  #ready: boolean
  readonly #logger: Logger
  readonly #app: Application
  #server: Server | null

  constructor (logger: Logger = { info: console.log }) {
    this.#server = null
    this.#logger = logger
    this.#live = true
    this.#ready = false
    this.#app = express()
    this.#app.disable('x-powered-by')
    this.#app.get('/liveness', this.#livenessProbe.bind(this))
    this.#app.get('/readiness', this.#readinessProbe.bind(this))
    this.#app.get('/metrics', this.#metricsProbe.bind(this))
  }

  /**
   * Calling this indicates the application is available for processing traffic.
   * After calling this the readiness probe will return status code 200 (send traffic).
   * Traffic can be stopped by calling {@linkcode TelemetryServer#signalNotReady}.
   * Metrics will still be available.
   * Tip: Call this as the last step of your application startup code, or if unavailable service dependencies
   * become available again.
   */
  signalReady (): void {
    this.#ready = true
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
  signalNotReady (): void {
    this.#ready = false
  }

  /**
   * Calling this indicates the application is no longer in a useful state.
   * After calling this the liveness probe will return status code 500 (terminate pod)
   * and the readiness probe will return 500 (stop traffic).
   * Note this will cause the application pod to be terminated.
   * Metrics will still be available until termination.
   * Tip: Call this just before {@linkcode TelemetryServer#stop}
   */
  signalStopped (): void {
    this.#live = false
    this.#ready = false
  }

  /**
   * Returns the underlying {@link https://github.com/expressjs/express|Express} object used by the telemetry server.
   * @returns {Express}
   */
  getApp (): Application {
    return this.#app
  }

  /**
   * Makes the telemetry probes available on a network port.
   * After calling this the liveness probe will return 200 (alive) and the readiness probe will return 500 (stop traffic).
   * The metrics probe will return all available metrics.
   * Tip: Call this as soon as possible in your application startup code.
   * @param {Number} telemetryPort the network port the probes should be available on.
   * @returns {TelemetryServer} Returns 'this' for convenience in calling other methods.
   */
  start (telemetryPort: number): TelemetryServer {
    if (this.#server !== null) {
      throw new Error('Service telemetry already started')
    }

    this.#logger.info('Service telemetry starting...')
    this.#server = this.getApp().listen(telemetryPort, () => {
      this.#logger.info(`Service telemetry is up on ${telemetryPort}`)
    })
    return this
  }

  /**
   * Withdraws the telemetry probes.
   * Tip: Call this as the last step in the shutdown code of your application.
   */
  stop (): void {
    if (this.#server === null) {
      throw new Error('Service telemetry not started')
    }

    this.#logger.info('Service telemetry stopping...')
    this.#server.close(() => {
      this.#logger.info('Service telemetry is stopped')
    })
  }

  #livenessProbe (_req: Request, res: Response): Response {
    return res.status(this.#mapToStatusCode(this.#live)).end()
  }

  #readinessProbe (_req: Request, res: Response): Response {
    return res.status(this.#mapToStatusCode(this.#ready)).end()
  }

  #metricsProbe (_req: Request, res: Response): void {
    void (async (): Promise<void> => {
      res.set('Content-Type', register.contentType)
      try {
        res.end(await register.metrics())
      } catch {
        res.status(500).end()
      }
    })()
  }

  #mapToStatusCode (state: boolean): number {
    return state ? 200 : 500
  }
}
