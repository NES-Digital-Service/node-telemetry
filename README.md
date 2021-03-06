# node-telemetry
Provides standard Kubernetes probes and Prometheus metrics endpoint for Node.js apps.

## Install

Configure npm with the NES Digital Service GitHub packages repository:

```shell
echo "@nes-digital-service:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=<PERSONAL ACCESS TOKEN>" >> .npmrc
```

If you do not have a GitHub personal access token then generate one from your [GitHub Developer Settings](https://github.com/settings/tokens).
To install this package the personal access token must have the `read:packages` scope.

Install the module with npm:

```shell
npm install --save @nes-digital-service/node-telemetry
```

## Usage

### API Documentation

API documentation for this library can be found [at our GitHub Pages site](https://nes-digital-service.github.io/node-telemetry).

### Kubernetes Lifecycle Probes

In the startup code for your Node.js application add the following code

```js
const TelemetryServer = require('./node-telemetry')

const TELEMETRY_PORT = 9090
const telemetry = new TelemetryServer().start(TELEMETRY_PORT)

// Your application startup code here

telemetry.signalReady()

function shutdown () {
  telemetry.signalNotReady()

  // Your application graceful shutdown code here
  
  telemetry.stop()
}

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.')
  shutdown()
})
```

Your Kubernetes pod configuration could then look something like:

```yaml
    spec:
      containers:
        - image: example
          name: example
          ports:
            - containerPort: 9090
              name: telemetry
          livenessProbe:
            httpGet:
              path: /liveness
              port: 9090
            initialDelaySeconds: 5
            periodSeconds: 3
            timeoutSeconds: 10
          readinessProbe:
            httpGet:
              path: /readiness
              port: 9090
            initialDelaySeconds: 5
            periodSeconds: 3
            timeoutSeconds: 10
```

### Exposing Metrics For Prometheus

The telemetry server exposes a metrics endpoint on `/metrics` which returns the result of calling the `Prometheus` object from
[prom-client](https://github.com/siimon/prom-client).  The telemetry server does not define or collect any metrics itself. This is the responsibility of the
application.

You can expose the [default prom-client application metrics](https://github.com/siimon/prom-client/blob/master/lib/defaultMetrics.js) by adding the following
code to your application:

```js
const prometheus = require('prom-client')

prometheus.collectDefaultMetrics
```

You can expose custom metrics by creating a prom-client metric and setting its value when appropriate:

```js
const { Counter } = require('prom-client')

const myCounter =  new Counter({
  name: 'example_counter',
  help: 'an example of a counter'
})

// when interesting event happens
myCounter.inc()
```

For more details on creating custom metrics see [prom-client](https://github.com/siimon/prom-client).

### Injecting A Logger

You can capture the log output from the telemetry server by passing in a logger object in the constructor.
The expected logger object is compatible with popular logging libraries like [winston](https://github.com/winstonjs/winston).

For example to output logging in JSON format, the code below...

```js
const winston = require('winston')

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'info',
      format: winston.format.json()
    })
  ]
})
const TELEMETRY_PORT = 9090
const telemetry = new TelemetryServer(logger).start(TELEMETRY_PORT)
```

... produces the following output on startup

```shell
{"level":"info","message":"Service telemetry starting..."}
{"level":"info","message":"Service telemetry is up on 9090"}

```

## For Maintainers

### Testing

This library comes with a suite of unit tests. To execute the unit tests:

```shell
npm test
```

### Publishing

This package will be published to GitHub Packages when a release is performed.
The package version number will be the same as the release tag.

Note: The workflows depend on the PACKAGES_TOKEN Organization Secret, which expires every 90 days, if it does create a Personal Access Token with the
`read:packages` scope and update the secret.