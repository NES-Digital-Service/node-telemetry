import TelemetryServer from './TelemetryServer'
import request from 'supertest'
import { register } from 'prom-client'
import express from 'express'

jest.mock('prom-client')
jest.mock('express')
const realExpress = jest.requireActual('express')
register.contentType = 'text/plain'
const mockLogger = { info: jest.fn() }

describe('TelemetryServer', () => {
  let telemetryServer: TelemetryServer

  describe('health probes', () => {
    beforeEach(() => {
      jest.mocked(express).mockImplementation(realExpress) // use real express for these tests
      telemetryServer = new TelemetryServer()
    })

    it('should show live / not ready on creation', async () => {
      // Then
      await request(telemetryServer.getApp()).get('/liveness').expect(200)
      await request(telemetryServer.getApp()).get('/readiness').expect(500)
    })

    it('should show live / ready after ready signal', async () => {
      // When
      telemetryServer.signalReady()

      // Then
      await request(telemetryServer.getApp()).get('/liveness').expect(200)
      await request(telemetryServer.getApp()).get('/readiness').expect(200)
    })

    it('should show live / not ready after not ready signal', async () => {
      // When
      telemetryServer.signalNotReady()

      // Then
      await request(telemetryServer.getApp()).get('/liveness').expect(200)
      await request(telemetryServer.getApp()).get('/readiness').expect(500)
    })

    it('should show not live / not ready after stopped signal', async () => {
      // When
      telemetryServer.signalStopped()

      // Then
      await request(telemetryServer.getApp()).get('/liveness').expect(500)
      await request(telemetryServer.getApp()).get('/readiness').expect(500)
    })
  })

  describe('metrics', () => {
    beforeEach(() => {
      jest.mocked(express).mockImplementation(realExpress) // use real express for these tests
      telemetryServer = new TelemetryServer()
    })

    it('should return metrics in openmetrics format', async () => {
      jest.mocked(register.metrics).mockResolvedValue('# HELP\n# TYPE')

      const response = await request(telemetryServer.getApp()).get('/metrics')
      expect(response.status).toEqual(200)
      expect(response.headers['content-type']).toMatch(/text\/plain/)
      expect(response.text).toContain('# HELP')
      expect(response.text).toContain('# TYPE')
    })

    it('should return 500 when metrics failed to register', async () => {
      jest.mocked(register.metrics).mockRejectedValue(new Error('foo'))
      const response = await request(telemetryServer.getApp()).get('/metrics')
      expect(response.status).toEqual(500)
      expect(response.headers['content-type']).toMatch(/text\/plain/)
    })
  })

  describe('start / stop', () => {
    const fakePort = 9999

    /*
     * Create a partial mock of the express module where the returned app is an actual express app with a mock listen function
     */
    const mockServer = {
      close: jest.fn().mockImplementation((fn) => {
        fn() // call the given callback to simulate server closed
      })
    }

    const mockApp = {
      ...realExpress(),
      get: jest.fn(),
      disable: jest.fn(),
      listen: jest.fn().mockImplementation((_port, fn) => {
        fn() // call the given callback to simulate server ready
        return mockServer
      })
    }

    beforeEach(() => {
      jest.clearAllMocks()
      jest.mocked(express).mockReturnValue(mockApp)
      telemetryServer = new TelemetryServer(mockLogger)
    })

    describe('start', () => {
      it('should start an express server listening on the given port', () => {
        // When
        telemetryServer.start(fakePort)

        // Then
        expect(express).toBeCalled()
        expect(mockApp.listen).toBeCalled()
        expect(mockApp.listen).toHaveBeenCalledWith(fakePort, expect.any(Function))
        expect(mockLogger.info.mock.calls.length).toBe(2)
        expect(mockLogger.info.mock.calls[0][0]).toBe('Service telemetry starting...')
        expect(mockLogger.info.mock.calls[1][0]).toBe(`Service telemetry is up on ${fakePort}`)
      })

      it('should throw error if already started', () => {
        // Given
        telemetryServer.start(fakePort)

        // Then
        expect(() => { telemetryServer.start(fakePort) }).toThrowError('Service telemetry already started')
      })
    })

    describe('stop', () => {
      it('should close the express server', () => {
        // Given
        telemetryServer.start(fakePort)

        // When
        telemetryServer.stop()

        // Then
        expect(mockServer.close).toBeCalled()
        expect(mockLogger.info).toHaveBeenCalledTimes(4)
        expect(mockLogger.info.mock.calls[0][0]).toBe('Service telemetry starting...')
        expect(mockLogger.info.mock.calls[1][0]).toBe(`Service telemetry is up on ${fakePort}`)
        expect(mockLogger.info.mock.calls[2][0]).toBe('Service telemetry stopping...')
        expect(mockLogger.info.mock.calls[3][0]).toBe('Service telemetry is stopped')
      })

      it('should throw error if not started', () => {
        // Then
        expect(() => { telemetryServer.stop() }).toThrowError('Service telemetry not started')
      })
    })
  })
})
