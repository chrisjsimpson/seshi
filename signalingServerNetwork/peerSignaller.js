peers = [];

var util = require('util'); //nodejs utilities

//Listen for a new SDP (Session description) offer or answer
var express = require('express');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var http = require('http');
var query = require('url');

var app = express();

// parse application/x-www-form-urlencoded
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
	extended: true
}));



//http://tinyurl.com/m3wv7ym
app.use(function(req, res, next) {
    	res.setHeader("Access-Control-Allow-Origin", "*");
	next();
  });


app.post('/', jsonParser, function (req, res) {
	console.log("Saving message ***" + req.body);
	//Add node to peers wanting to find each other
	peers[req.body];
	debugger;

  	res.send(JSON.stringify(req.body, null, 2));
})//End show posted data



	//res.setHeader('Access-Control-Allow-Origin', '*');
	//var boxId = query.parse(req.url, true).query.changeToBoxId;

	//Push data into peers array
	//peers.push(boxId);

	//console.log("boxId is: " + boxId);
        //res.write('boxId is: ' + boxId + '\r\n' );

	//console.log(JSON.stringify(peers));
	
	//Print peer count
	//console.log("There are: " + peers.length + ' peers');

var server = app.listen(8000, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log("Listening at http://%s:%s", host, port);
})
