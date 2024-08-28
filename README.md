# Purpose

Use this plugin to get a breakdown of latency and response codes based on a request header.
This can be useful if you are using a csv file to drive a bunch of tests, and want to subdivide the results a bit, and your endpoint is static.

Examples could be the SOAPAction header.

This is based on the `artillery-plugin-metrics-by-endpoint`

Supports both `Server-Timing` and `TTFB` reporting.

## Plugin Documentation

### Configuration
```
  plugins:
    metrics-by-header: 
      useHeaderName: 'x-command'
```



# License

MPL 2.0