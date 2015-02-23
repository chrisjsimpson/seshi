var http = require("http");
var url = require("url");

// Creates a handler to collect POSTed data and to route the
// request based on the path name
function start(handle, port) {
  function onRequest(req, res) {
    var urldata = url.parse(req.url,true),
        pathname = urldata.pathname,
        info = {"res": res,
                "query": urldata.query,
                "postData":""};
 
    //log("Request for " + pathname + " received");
    req.setEncoding("utf8");
    req.addListener("data", function(postDataChunk) {
      info.postData += postDataChunk;
      //log("Received POST data chunk '"+ postDataChunk + "'.");
    });
    req.addListener("end", function() {
      route(handle, pathname, info);
    });
  }

  http.createServer(onRequest).listen(port);
 
  console.log("Server started on port " + port);
}

// Determines whether requested path is a static file or a custom
// path with its own handler
function route(handle, pathname, info) {
      //console.log("About to route a request for " + pathname);
      handleCustom(handle, pathname, info);
}


// Confirm handler for non-file path, then execute it
function handleCustom(handle, pathname, info) {
  if (typeof handle[pathname] == 'function') {
    handle[pathname](info);
  } else {
    noHandlerErr(pathname, info.res);
  }
}


// If no handler is defined for the request, return 404
function noHandlerErr(pathname, res) {
  console.log("No request handler found for " + pathname);
  res.writeHead(404, {"Content-Type": "text/plain"});
  res.write("404 Page Not Found");
  res.end();
}


var connections = {},
    partner = {},
    messagesFor = {},
    peers = {}; //Object of Peers waiting to be connected to indexed by their uuid. peer[uuid].sdp 


// queue the sending of a json response
function webrtcResponse(response, res) {
  /* log("replying with webrtc response " +
      JSON.stringify(response)); */
  res.header("Access-Control-Allow-Origin", "*");
  res.writeHead(200, {"Content-Type":"application/json"});

  if(response.msgs != "" && typeof response.err != "string" && typeof response != "string")
  {
  	console.log("WebrtcResponse: \r\n" + JSON.stringify(response) + '\r\n');
  }

  res.write(JSON.stringify(response));
  res.end();
}


// send an error as the json WebRTC response
function webrtcError(err, res) {
  //log("replying with webrtc error:  " + err);
  webrtcResponse({"err": err}, res);
}


// Queues message in info.postData.message for sending to the
// partner of the id in info.postData.id
function send(info) {
  console.log("postData received is ***" + info.postData + "***");
  var postData = JSON.parse(info.postData),
      res = info.res;

  //Add partner to messagesFor object if not already apart of it
  if ( typeof peers[postData.id] == 'undefined' ) {
	console.log("First time this partner has connected wooo!");
        peers[postData.id] = [];
  }//End create peer entry and iniciate array for SDP offers and candidates
	peers[postData.id].push(postData.message);

  //messagesFor[partner[postData.id]].push(postData.message);
	debugger;
  if (typeof postData === "undefined") {
    webrtcError("No posted data in JSON format!", res);
    return;
  }
  if (typeof (postData.message) === "undefined") {
    webrtcError("No message received", res);
    return;
  }
  if (typeof (postData.id) === "undefined") {
    webrtcError("No id received with message", res);
    return;
  }
  if (typeof (partner[postData.id]) === "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }
  if (typeof (messagesFor[partner[postData.id]]) ===
              "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }
  messagesFor[partner[postData.id]].push(postData.message);
  console.log("Saving message ***" + postData.message +
      "*** for delivery to id " + partner[postData.id]); 
  webrtcResponse("Saving message ***" + postData.message +
                 "*** for delivery to id " +
                 partner[postData.id], res);
}


// Returns all messages queued for info.postData.id
function get(info) {
  var postData = JSON.parse(info.postData),
      res = info.res;

  if (typeof postData === "undefined") {
    webrtcError("No posted data in JSON format!", res);
    return;
  }
  if (typeof (postData.id) === "undefined") {
    webrtcError("No id received on get", res);
    return;
  }
  if (typeof (messagesFor[postData.id]) === "undefined") {
    webrtcError("Invalid id " + postData.id, res);
    return;
  }

  /* log("Sending messages ***" +
      JSON.stringify(messagesFor[postData.id]) + "*** to id " +
      postData.id); */
  webrtcResponse({'msgs':messagesFor[postData.id]}, res);
  messagesFor[postData.id] = [];
}


var port = process.argv[2] || 8000;


// returns 404
function fourohfour(info) {
  var res = info.res;
  //log("Request handler fourohfour was called.");
  res.writeHead(404, {"Content-Type": "text/plain"});
  res.write("404 Page Not Found");
  res.end();
}

var handle = {};
handle["/send"] = send;
handle["/get"] = get;
start(handle, port);
