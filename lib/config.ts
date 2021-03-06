/// <reference path='../typings/tsd.d.ts' />

import events = require('events');
import fs = require('fs');
import path = require('path');
import convict = require('convict');
import bunyan = require('bunyan');
import optimist = require('optimist');
import util = require('util');

var convictConf: convict.Config;
var otherConf: {[index: string]: any};

export function get(name: string): any
{
    if (name in otherConf) {
        return otherConf[name];
    }

    return convictConf.get(name);
}

export var emitter = new events.EventEmitter();

// Initialization
((): void =>
{
    otherConf = {};

    // Convict from file
    convictConf = convict({
        'api': {
            'host': {
                doc: 'The Bloomberg Open API server address',
                format: 'ipaddress',
                default: '127.0.0.1',
                env: 'BLPAPI_HTTP_API_HOST',
                arg: 'api-host'
            },
            'port': {
                doc: 'The Bloomberg Open API server port',
                format: 'port',
                default: 8194,
                env: 'BLPAPI_HTTP_API_PORT',
                arg: 'api-port'
            },
            'authenticationMode': {
                doc: 'The authentication mode to use for B-PIPE Authorization',
                format: String,
                default: 'APPLICATION_ONLY',
                env: 'BLPAPI_HTTP_API_AUTHENTICATION_MODE',
                arg: 'api-authenticationMode'
            },
            'authenticationAppName': {
                doc: 'The application name for authentication purposes',
                format: String,
                default: '',
                env: 'BLPAPI_HTTP_API_AUTHENTICATION_APPNAME',
                arg: 'api-authenticationAppName'
            }
        },
        'port': {
            doc: 'The http port to listen on',
            format: 'port',
            default: 80,
            env: 'BLPAPI_HTTP_PORT',
            arg: 'port'
        },
        'expiration': {
            doc: 'Auto-expiration period of blpSession in seconds',
            format: 'integer',
            default: 5,
            arg: 'session-expiration'
        },
        'https': {
            'enable': {
                doc: 'Boolean option to control whether the server runs on https mode',
                format: Boolean,
                default: false,
                arg: 'https-enable'
            },
            'ca': {
                doc: 'HTTPS server ca',
                format: String,
                default: '../keys/bloomberg-ca-crt.pem',
                arg: 'https-ca'
            },
            'cert': {
                doc: 'HTTPS server certification',
                format: String,
                default: '../keys/hackathon-crt.pem',
                arg: 'https-cert'
            },
            'key': {
                doc: 'HTTPS server key',
                format: String,
                default: '../keys/hackathon-key.pem',
                arg: 'https-key'
            },
            'crl': {
                doc: 'HTTPS server certificate revocation list',
                format: String,
                default: '',
                arg: 'https-crl'
            }
        },
        'logging': {
            'stdout': {
                doc: 'Boolean option to control whether to log to stdout',
                format: Boolean,
                default: true,
                arg: 'logging-stdout'
            },
            'stdoutLevel': {
                doc: 'Log level to for stdout',
                format: String,
                default: 'info',
                arg: 'logging-stdoutLevel'
            },
            'logfile': {
                doc: 'Log file path',
                format: String,
                default: 'blpapi-http.log',
                arg: 'logging-logfile'
            },
            'logfileLevel': {
                doc: 'Log level to for log file',
                format: String,
                default: 'trace',
                arg: 'logging-logfileLevel'
            },
            'reqBody': {
                doc: 'Boolean option to control whether to log request body',
                format: Boolean,
                default: false,
                arg: 'logging-reqBody'
            },
            'clientDetail': {
                doc: 'Boolean option to control whether to log client details',
                format: Boolean,
                default: false,
                arg: 'logging-clientDetail'
            }
        },
        'service': {
            'name': {
                doc: 'The service name',
                format: String,
                default: 'BLPAPI-HTTP',
                arg: 'service-name'
            },
            'version': {
                doc: 'The service version',
                format: String,
                default: '1.0.0',
                arg: 'service-version'
            }
        },
        'maxBodySize': {
            doc: 'Maximum size of the request body in byte',
            format: 'integer',
            default: 1024,
            arg: 'maxBodySize'
        },
        'throttle': {
            'burst': {
                doc: 'Throttle burst',
                format: 'integer',
                default: 100,
                arg: 'throttle-burst'
            },
            'rate': {
                doc: 'Throttle rate',
                format: 'integer',
                default: 50,
                arg: 'throttle-rate'
            }
        },
        'websocket': {
            'socket-io': {
                'enable': {
                    doc: 'Boolean option to control whether to run socket.io server',
                    format: Boolean,
                    default: true,
                    arg: 'websocket-socket-io-enable'
                },
                'port': {
                    doc: 'The socket io port to listen on',
                    format: 'port',
                    default: 3001,
                    arg: 'websocket-socket-io-port'
                },
            },
            'ws': {
                'enable': {
                    doc: 'Boolean option to control whether to run ws server',
                    format: Boolean,
                    default: true,
                    arg: 'websocket-ws-enable'
                },
                'port': {
                    doc: 'The ws port to listen on',
                    format: 'port',
                    default: 3002,
                    arg: 'websocket-ws-port'
                },
            }
        },
        'longpoll': {
            'maxbuffersize': {
                doc: 'Maximum buffer size for subscription data',
                format: 'integer',
                default: 50,
                arg: 'longpoll-maxbuffersize'
            },
            'pollfrequency': {
                doc: 'Data checking frequency when poll request arrives',
                format: 'integer',
                default: 100,
                arg: 'longpoll-pollfrequency'
            },
            'polltimeout': {
                doc: 'Server side poll request timeout in ms',
                format: 'integer',
                default: 30000,
                arg: 'longpoll-polltimeout'
            }
        }
    });

    if (optimist.argv.cfg) {
        convictConf.loadFile(optimist.argv.cfg);
    }
    convictConf.validate();

    // Build options object
    // Bunyan logger options
    // Override default bunyan response serializer
    bunyan.stdSerializers['res'] = function(res: any): any {
        if (!res || !res.statusCode) {
            return res;
        }
        return {
            statusCode: res.statusCode,
            header: res._headers
        };
    };
    // Add client cert serializer
    bunyan.stdSerializers['cert'] = function(cert: any): any {
        return cert && {
            CN: cert.subject.CN,
            fingerprint: cert.fingerprint
        };
    };
    var streams: {}[] = [{level: convictConf.get('logging.logfileLevel'),
                          path: convictConf.get('logging.logfile')}];
    if (convictConf.get('logging.stdout')) {
        streams.push({
            level: convictConf.get('logging.stdoutLevel'),
            stream: process.stdout
        });
    }
    otherConf['loggerOptions'] = {
        name: convictConf.get('service.name'),
        streams: streams,
        serializers: bunyan.stdSerializers
    };

    // Restify bodyParser plugin options
    otherConf['bodyParserOptions'] = {
        maxBodySize: convictConf.get('maxBodySize'),
        mapParams: false
    };

    // Restify throttle plugin options
    otherConf['throttleOptions'] = {
        burst: convictConf.get('throttle.burst'),
        rate: convictConf.get('throttle.rate'),
        ip: true,
        overrides: {
            '127.0.0.1': {
                rate: 0,
                burst: 0
            }
        }
    };

    // HTTP(S) server options
    otherConf['serverOptions'] = {
        name: convictConf.get('service.name'),
        version: convictConf.get('service.version'),
        acceptable: ['application/json']
    };
    if (convictConf.get('https.enable')) {
        otherConf['serverOptions'].httpsServerOptions = {
            key: fs.readFileSync(path.resolve(__dirname,
                                              convictConf.get('https.key'))),
            cert: fs.readFileSync(path.resolve(__dirname,
                                               convictConf.get('https.cert'))),
            ca: fs.readFileSync(path.resolve(__dirname,
                                             convictConf.get('https.ca'))),
            requestCert: true,
            rejectUnauthorized: true
        };

        // For server that wants to use CRL
        if (convictConf.get('https.crl')) {
            var crlPath = path.resolve(__dirname, convictConf.get('https.crl'));
            otherConf['serverOptions'].httpsServerOptions.crl = fs.readFileSync(crlPath);
            // Setup file watch for crl changes
            fs.watch(crlPath, (event: string, filename: string): void => {
                // Re-read the crl file
                otherConf['serverOptions'].httpsServerOptions.crl = fs.readFileSync(crlPath);
                emitter.emit('change', 'https.crl');  // Signal the server that config changes
            });
        }
    }

    // BLPAPI Session options
    var blpapiSessionOptions: any = {
        serverHost: convictConf.get('api.host'),
        serverPort: convictConf.get('api.port')
    };

    var authorizeOnStartup = false;
    var authenticationOptions: string = null;
    var appName = convictConf.get('api.authenticationAppName');
    if ('' !== appName) {
        var mode = convictConf.get('api.authenticationMode');
        if ('APPLICATION_ONLY' !== mode) {
            throw new Error(util.format('Bad value for api.authenticationMode: %s', mode));
        }
        authorizeOnStartup = true;
        // TODO: Add support for USER_AND_APPLICATION
        authenticationOptions = util.format('AuthenticationMode=%s;' +
                                            'ApplicationAuthenticationType=APPNAME_AND_KEY;' +
                                            'ApplicationName=%s',
                                            mode,
                                            appName);
    }
    // TODO: Add support for user-only auth modes.

    if (null !== authenticationOptions) {
        blpapiSessionOptions['authenticationOptions'] = authenticationOptions;
    }
    otherConf['sessionOptions'] = {
        blpapiSessionOptions: blpapiSessionOptions,
        authorizeOnStartup: authorizeOnStartup
    };

})();
