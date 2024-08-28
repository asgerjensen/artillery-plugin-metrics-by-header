/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 const url = require('url');

 module.exports = { Plugin: MetricsByHttpHeader };
 
 const debug = require('debug')('plugin:metrics-by-endpoint');
 
 let useHeaderName;
 let stripQueryString;
 let ignoreUnnamedRequests;
 let metricsPrefix;
 let groupDynamicURLs;
 
 // NOTE: Will not work with `parallel` - need request UIDs for that
 function MetricsByHttpHeader(script, events) {
   // if(!global.artillery || !global.artillery.log) {
   //   console.error('artillery-plugin-metrics-endpoint requires Artillery v2');
   //   return;
   // }
 
   // If running in Artillery v2, the plugin should only load in workers
   if (
     global.artillery &&
     Number(global.artillery.version.slice(0, 1)) > 1 &&
     typeof process.env.LOCAL_WORKER_ID === 'undefined'
   ) {
     debug('Not running in a worker, exiting');
     return;
   }
 
   if (!script.config.processor) {
     script.config.processor = {};
   }
 
   useHeaderName =
     script.config.plugins['metrics-by-header'].headerName || 'x-command';
   metricsPrefix =
     script.config.plugins['metrics-by-header'].metricsNamespace ||
     'plugins.metrics-by-header';

   script.config.processor.metricsByHeader_afterResponse =
     metricsByHeader_afterResponse;
   script.config.processor.metricsByHeader_onError = metricsByHeader_onError;
   script.config.processor.metricsByHeader_beforeRequest =
     metricsByHeader_beforeRequest;
 
   script.scenarios.forEach(function (scenario) {
     scenario.afterResponse = [].concat(scenario.afterResponse || []);
     scenario.afterResponse.push('metricsByHeader_afterResponse');
     scenario.onError = [].concat(scenario.onError || []);
     scenario.onError.push('metricsByHeader_onError');
     scenario.beforeRequest = [].concat(scenario.beforeRequest || []);
     scenario.beforeRequest.push('metricsByHeader_beforeRequest');
   });
 }
 
 
 function metricsByHeader_beforeRequest(req, userContext, events, done) {
   if (groupDynamicURLs) {
     req.defaultName =  req.headers[useHeaderName];
   }
 
   return done();
 }
 
 function metricsByHeader_onError(err, req, userContext, events, done) {
   //if groupDynamicURLs is true, then req.defaultName is set in beforeRequest
   //otherwise, we must calculate the reqName here as req.url is the non-templated version
   const reqName =  req.headers[useHeaderName];
 
   if (reqName === '') {
     return done();
   }
 
   events.emit(
     'counter',
     `${metricsPrefix}.${reqName}.errors.${err.code || err.name}`,
     1
   );
 
   done();
 }
 
 function metricsByHeader_afterResponse(req, res, userContext, events, done) {
   //if groupDynamicURLs is true, then req.defaultName is set in beforeRequest
   //otherwise, we must calculate the reqName here as req.url is the non-templated version
   const reqName =  req.headers[useHeaderName];
   if (reqName === '') {
     return done();
   }
 
   const histoName = `${metricsPrefix}.response_time.${reqName}`;
 
   if (res.headers['server-timing']) {
     const timing = getServerTimingTotal(res.headers['server-timing']);
     events.emit(
       'histogram',
       `${metricsPrefix}.server-timing.${reqName}`,
       timing
     );
   }
 
   events.emit(
     'counter',
     `${metricsPrefix}.${reqName}.codes.${res.statusCode}`,
     1
   );
   events.emit('histogram', histoName, res.timings.phases.firstByte);
   return done();
 }
 
 function getServerTimingTotal(s) {
   const matches = s.match(/total;dur=[0-9.]+/gi);
   if (matches !== null && matches.length > 0) {
     // we always grab the first instance of "total" if there's more than one
     return Number(matches[0].split('=')[1] || 0);
   } else {
     // no match
     return -1;
   }
 }