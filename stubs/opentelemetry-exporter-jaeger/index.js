'use strict';

class JaegerExporter {
  constructor() {
    throw new Error('Jaeger telemetry is disabled in Noesis.');
  }
}

module.exports = { JaegerExporter };
