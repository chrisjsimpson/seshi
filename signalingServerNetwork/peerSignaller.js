connections = {}; /* Connections is an object with objects attatched named by their CIDs which contain their related BOXid and SDP data */

var util = require('util'); //nodejs utilities

//Listen for a new SDP (Session description) offer or answer
var express = require('express');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var http = require('http');
var query = require('url');

var app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: false 
}));
app.use( bodyParser.json() );



//http://tinyurl.com/m3wv7ym
app.use(function(req, res) {
	res.setHeader("Content-Type","text/plain");
    	//res.setHeader("Access-Control-Allow-Origin", "*");
	res.write("Test");
	res.end(util.inspect(req));
  });


//app.post('/', jsonParser, function (req, res) {
//	console.log("Saving message ***" + req.body);
//	debugger;
	//Add node to connections object of peers wanting to find each other
		//Check dosn't already exist (peer has found their friend!)
//		if ( typeof connections[req.body.cid] == "undefined" ) {
//			console.log("First time connect, should add to connections object...");	
//		} //End add first time connect peer to connections object

	//messagesFor[partner[postData.id]].push(postData.message);
	
	//peers[req.body];
//	var test = {"Hello":"Sucess... ;)"};
//  	res.send(JSON.stringify(test));
//})//End show posted data


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
