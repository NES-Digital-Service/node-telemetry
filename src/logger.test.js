const logger = require('./logger')

describe('logger', () => {
  beforeEach(() => {
    global.Date = jest.fn().mockReturnValue({
      toISOString: () => 'test date'
    })

    global.console = {
      log: jest.fn()
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('prints log message', () => {
    logger.info('test')

    const calledWith = JSON.parse(console.log.mock.calls[0][0])

    expect(calledWith).toEqual({ message: 'test', level: 'info', timestamp: 'test date' })
  })

  it('prints warn message', () => {
    logger.warn('test')

    const calledWith = JSON.parse(console.log.mock.calls[0][0])

    expect(calledWith).toEqual({ message: 'test', level: 'warn', timestamp: 'test date' })
  })

  it('prints error message', () => {
    logger.error('test')

    const calledWith = JSON.parse(console.log.mock.calls[0][0])

    expect(calledWith).toEqual({ message: 'test', level: 'error', timestamp: 'test date' })
  })
})
