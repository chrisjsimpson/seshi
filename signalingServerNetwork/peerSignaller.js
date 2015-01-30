peers = [];

//Listen for a new SDP (Session description) offer or answer
var http = require('http');
var query = require('url');

var server = http.createServer(function(req, res) {
        console.log('client connected');

        req.on('end', function() {
                console.log('client disconnected');
        });

	res.setHeader('Access-Control-Allow-Origin', '*');

	var key = query.parse(req.url, true).query.key;
	
	//Push data into peers array
	peers.push(key);

	console.log("Key is: " + key);
        res.write('Key is: ' + key + '\r\n' );

	console.log(JSON.stringify(peers));
	
	//Print peer count
	console.log("There are: " + peers.length + ' peers');

	res.end();
})

server.listen(8000);
