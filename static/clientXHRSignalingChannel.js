// This code creates the client-side commands for an XML HTTP
// Request-based signaling channel for WebRTC.

// The signaling channel assumes a 2-person connection via a
// shared key.  Every connection attempt toggles the state
// between "waiting" and "connected", meaning that if 2 browsers
// are connected and another tries to connect the existing
// connection will be severed and the new browser will be
// "waiting".

var createSignalingChannel = function(key, handlers) {


var id, status, doNothing = function(){},
  handlers = handlers || {},
  initHandler = function(h) {
    return ((typeof h === 'function') && h) || doNothing;
  },
  waitingHandler = initHandler(handlers.onWaiting),
  connectedHandler = initHandler(handlers.onConnected),
  messageHandler = initHandler(handlers.onMessage);


// Set up connection with signaling server
function connect(failureCB) {
  var failureCB = (typeof failureCB === 'function') ||
                  function() {};

  // Handle connection response, which should be error or status
  //  of "connected" or "waiting"
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          failureCB("error:  " + res.err);
          return;
        }

        // if no error, save status and server-generated id,
        // then start asynchronouse polling for messages
        id = res.id;
        status = res.status;
        poll();

        // run user-provided handlers for waiting and connected
        // states
        if (status === "waiting") {
          waitingHandler();
        } else {
	  connectedHandler();
        }
        return;
      } else {
        failureCB("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // For each signalingServer stored in indexedDB, connect to it with key then
  // open XHR and send the connection request with the key
	
	signalServerDb.signalServers.each(function(signalingServer){
	
		 var client = new XMLHttpRequest();
		 client.onreadystatechange = handler;
		 client.open("GET", "http://" + signalingServer.address + "/connect?key=" + key);
		 client.send();
	}).catch(function(error){
		console.error(error);
	});
}//End connect()

function poll() {
  var msgs;
  // get fetches messages from the server and then schedules itself to run
  // again after x milliseconds untill x.
	invoke(function(){	
		get(function (response) {
		var i, msgs = (response && response.msgs) || [];
		// if messages property exists, then we are connected   
		if (response.msgs && (status !== "connected")) {
		// switch status to connected since it is now!
		status = "connected";
		connectedHandler();
		}
		if (msgs.length > 0) {           // we got messages
		for (i=0; i<msgs.length; i+=1) {
		  console.log("The msg is: " + msgs[i]);	
		  handleMessage(msgs[i]);
		}
		}// didn't get any messages
		})},
		0, 3000,60000);
}//End of poll()


// This function is part of the polling setup to check for
// messages from the other browser.  It is called by getLoop()
// inside poll().
function get(getResponseHandler) {

  // response should either be error or a JSON object.  If the
  // latter, send it to the user-provided handler.
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          getResponseHandler("error:  " + res.err);
          return;
        }
        getResponseHandler(res);
        return res;
      } else {
        getResponseHandler("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // For each signaling server in db,
  // open XHR and request messages for my id every x secconds
		signalServerDb.signalServers.each(function(signalingServer){
			var client = new XMLHttpRequest();
			client.onreadystatechange = handler;
			client.open("POST", "http://" + signalingServer.address + "/get");
			var id = document.getElementById('key').value;
			client.send(JSON.stringify({"id":id}));
			//console.log("Getting..." + Math.random());
		}).catch(function(error) {
			console.error(error);
		})
	//End invoke /get messages every interval secconds untill end. invoke(f,start,interval, end)
}


// Schedule incoming messages for asynchronous handling.
// This is used by getLoop() in poll().
function handleMessage(msg) {   // process message asynchronously
  setTimeout(function () {messageHandler(msg);}, 0);
}


// Send a message to the other browser on the signaling channel
function send(msg, responseHandler) {
  var reponseHandler = responseHandler || function() {};

  // parse response and send to handler
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          responseHandler("error:  " + res.err);
          return;
        }
        responseHandler(res);
        return;
      } else {
        responseHandler("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // fOR EACH SIGNALLINGsERVER IN DB,
  // open XHR and send my id and message as JSON string
	signalServerDb.signalServers.each(function(signalingServer){
		var client = new XMLHttpRequest();
		client.onreadystatechange = handler;
		client.open("POST", "http://" + signalingServer.address + "/send");
		var id = document.getElementById('key').value;
		var sendData = {"id":id, "message":msg};
		client.send(JSON.stringify(sendData));
	}).catch(function(error){
		console.error(error);
	});
}

return {
  connect:  connect,
  send:  send
};
};

function ok(){
	console.log("OK " + Math.random());
}

//Check if connected every x secconds
invoke(connectedStatus, 0, 1000);

function connectedStatus(){
	if ( typeof dc=== 'undefined' || dc === null || dc.readyState !== 'open') {
		console.log("No yet connected.");
		//Remove glow from logo
		var logo = document.getElementById('logo');
		//logo.className = '';
	} else if (dc.readyState === 'open') {
		console.log("We are connected.");
		//Add glow to logo
		var logo = document.getElementById('logo');
		//logo.className = 'glow';
	}
}

function invoke(f,start, interval, end) {
	if(!start) start = 0; //Default to 0ms
	if(arguments.length <= 2) //Single-invokation case
		setTimeout(f, start);//Single invocation after tart ms.
	else {			//Multiple invocation case
		setTimeout(repeat, start); // Repetitions begin in start ms
		function repeat() {	//Invoked by the timeout above
			var h = setInterval(f, interval); // Invoke f every interval ms.
			// And stop invoking after end ms, if end is defined
			if (end) setTimeout(function() { clearInterval(h);}, end);
		}
	}
}//End invoke
