var server = require("./server");
var requestHandlers = require("./serverXHRSignalingChannel");
var log = require("./log").log;
var port = process.argv[2] || 5001;

//Returns 404
function fourohfour(info) {
    var res = info.res;
    log("Request handlr fourohfour was called");
    res.writeHead(404,{"Content-Type":"text/plain"});
    res.write("404 Page not found");
    res.end();
}

var handle = {};
handle["/"] = fourohfour;
handle["/connect"] = requestHandlers.connect;
handle["/send"] = requestHandlers.send;
handle["/get"] = requestHandlers.get;

server.serveFilePath("static");
server.start(handle,port);
