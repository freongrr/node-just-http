var server = require("./server.js").createServer();

// Map / to the index file in the www-test directory
server.map("^/$", "./www-test/index.html");

// Map this path to a method
server.map("^/dynamic$", function (request, response) {
    // Always surround this code with a try/catch
    try {
        var message = require('util').format('Hi %s, it is %s',
            request.socket.remoteAddress, new Date().toString());

        server.sendHtml(response, message);
    } catch (e) {
        server.sendError(response, e);
    }
});

// Map everything else to files in the www-test directory
server.map("^/(.+)$", "./www-test/$1");

server.listen(4321);
