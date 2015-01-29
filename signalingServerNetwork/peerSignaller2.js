var net = require('net');

var client = net.connect({port:8000},
        function() { //'connect' listener
        console.log('connected to server!');

        //Write something every three secconds
        setInterval(function() {
                client.write('192.145.5.2');
        }, 3);

});

