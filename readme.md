just-http
=========

Simple, semi-static, http server. Mostly the result of my playing around with
the http and fs modules, but it may serve someone.

Installation
------------

Install from npm:

    npm install just-http

Usage
-----

Create a new server:

    var server = require("just-http").createServer();

Map path to files using regular expressions:

    server.map("^/$", "./www-test/index.html");
    server.map("^/(.+)$", "./www-test/$1");

Map a path to a function, to serve dynamic content:

    server.map("^/dynamic$", function (request, response) {
        try {
            // TODO : do something smart
        } catch (e) {
            // never let exceptions bubble up
            server.sendError(response, e);
        }
    });

Contribute
----------

github repository:

    https://github.com/freongrr/node-just-http
