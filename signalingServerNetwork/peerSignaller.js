peers = [];

//Listen for a new SDP (Session description) offer or answer
var net = require('net');

var server = net.createServer(function(c) {
        console.log('client connected');

        c.on('end', function() {
                console.log('client disconnected');
        });

        c.write('hello\r\n');
        c.pipe(c);

        c.on('data', function(data) {
                //Push data into peers array
                peers.push(data.toString());

                console.log(JSON.stringify(peers));
                //Print peer count
                console.log("There are: " + peers.length);
        });

})

server.listen(8000);

