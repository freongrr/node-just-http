var fs     = require('fs');
var util   = require('util');
var http   = require('http');
var url    = require('url');
var spawn  = require("child_process").spawn;
var mime   = require('mime');

var MODULE = "just-http";
var VERSION = "N/A";

// Cheesy...
try {
    var json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    MODULE = json.name;
    VERSION = json.version;
} catch (e) {
}

var logger = require('just-logging').getLogger(MODULE);

/* exports */

exports.createServer = function () {
    return new HttpServer();
};

/* HttpServer object */

function HttpServer() {
    this.mappings = {};
    this.server = http.createServer(_newRequestHandler(this));
}

HttpServer.prototype.map = function (from, to) {
    this.mappings[from] = to;
};

HttpServer.prototype.listen = function (port, host) {
    this.server.listen(port, host);
}

HttpServer.prototype.sendHtml = function (response, html, statusCode) {
    try {
        response.writeHead(statusCode || 200,
            { 'Content-Length': html.length,
              'Content-Type': 'text/html' });
        response.write(html);
        response.end();
    } catch (e) {
        logger.warn("Could not send the response", e);
    }
}

HttpServer.prototype.sendError = function (response, error, statusCode) {
    try {
        statusCode = statusCode || 500;

        var message = "ERROR " + statusCode + " - ";
        if (error instanceof Error) {
            message += error.message;
        } else {
            message += error;
        }

        var html =
              "<html>"
            + "<head>"
            + "<title>ERROR</title>"
            + "</head>"
            + "<body>"
            + "<h1>" + message + "</h1>"
            + "<hr/>"
            + "<i>" + MODULE + " - " + VERSION + "</i>"
            + "</body>"
            + "</html>";

        response.writeHead(statusCode, {
            'Content-Length': html.length,
            'Content-Type': 'text/html' });
        response.write(html);
        response.end();
    } catch (e) {
        logger.warn("Could not send the error", e);
    }
}

HttpServer.prototype.sendFile = function (response, filePath) {
    var this0 = this;
    _getMetaData(filePath, function (error, size, mimeType, encoding) {
        try {
            if (error instanceof NoSuchFileError) {
                logger.warn("No such file: " + filePath);
                error = new Error("No such file");
                this0.sendError(response, error, 404);
            } else if (error) {
                logger.error("Error getting file metadata", error);
                error = new Error("Internal server error");
                this0.sendError(response, error, 500);
            } else {
                var stream = fs.createReadStream(filePath);
                _sendStream(response, stream, size, mimeType, encoding);
            }
        } catch (e) {
            logger.error("Error sending the file", e);
            e = new Error("Internal server error");
            this0.sendError(response, e, 500);
        }
    });
}

/* Private methods */

function _newRequestHandler(server) {
    return function _handleRequest(request, response) {
        try {
            var path = url.parse(request.url).pathname;
            logger.info("Request from %s: %s",
                request.socket.remoteAddress, path);

            var mappingFrom, mappingTo;
            for (from in server.mappings) {
                if (path.match(from)) {
                    mappingFrom = from;
                    mappingTo = server.mappings[from];
                    break;
                }
            }

            if (mappingTo === undefined) {
                logger.error("No mapping for '%s'", path);
                server.sendError(response, "Can't find resource: " + path, 404);
            } else if (mappingTo instanceof Function) {
                var functionName = mappingTo.name
                    ? mappingTo.name + "()" : "anonymous function";
                logger.debug("Mapping to %s", functionName);
                mappingTo(request, response);
            } else {
                var file = path.replace(new RegExp(mappingFrom), mappingTo);
                logger.debug("Mapping to file '%s'", file);
                server.sendFile(response, file);
            }
        } catch (e) {
            logger.error("Error handling request", e);
            e = new Error("Internal server error");
            server.sendError(response, e.message, 500);
        }
    };
}

function _sendStream(response, stream, size, mimeType, encoding) {
    try {
        logger.debug("Sending file '%s' (%s)", stream.path, mimeType);
        response.writeHead(200, {
            'Content-Length': size,
            'Content-Type': mimeType + '; charset=' + encoding
        });
        stream.pipe(response);
    } catch (e) {
        logger.warn("Could not send file", e);
    }
}

function _getMetaData(file, callback) {
    _getSize(file, function (e1, size) {
        if (e1) {
            callback(e1);
        } else {
            _getMimeType(file, function (e2, mimeType) {
                if (e2) {
                    callback(e2);
                } else {
                    _getEncoding(file, function (e3, encoding) {
                        if (e3) {
                            callback(e3);
                        } else {
                            callback(null, size, mimeType, encoding);
                        }
                    });
                }
            });
        }
    });
}

function _getMimeType(file, callback) {
    try {
        callback(null, mime.lookup(file));
    } catch (e) {
        callback(e);
    }
}

function _getSize(file, callback) {
    try {
        fs.stat(file, function (error, stats) {
            // logger.debug("Stat of " + file + " is", stats);
            if (error) {
                if (error.toString().indexOf("ENOENT") >= 0) {
                    callback(new NoSuchFileError(error));
                } else {
                    callback(error);
                }
            } else if (stats.isDirectory()) {
                callback(new Error("Can't read directories"));
            } else {
                callback(null, stats.size);
            }
        });
    } catch (e) {
        callback(e);
    }
}

function _getEncoding(file, callback) {
    try {
        var process = spawn("file", ["--brief", "--mime-encoding", file]);

        process.stderr.on("data", function (output) {
            output = output.toString().replace(/\n$/, "");
            if (process.exitCode == 127) {
                // TODO : fallback to some other method?
                logger.warn("Could not use 'file' to determine the encoding");
                callback(null, "text/plain");
            } else {
                callback(new Error(output));
            }
        });

        process.stdout.on("data", function (output) {
            output = output.toString().replace(/\n$/, "");
            if (output.indexOf("cannot open") >= 0) {
                output = output.replace("ERROR: ", "");
                callback(new Error(output));
            } else {
                callback(null, output);
            }
        });
    } catch (e) {
        callback(e);
    }
}

/* Custom Exceptions */

function NoSuchFileError(message) {
    this.message = message;
}

util.inherits(NoSuchFileError, Error);
