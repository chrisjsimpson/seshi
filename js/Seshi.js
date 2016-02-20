Seshi = {
    welcome:(function(){   /* 
                        #   Seshi Init
                        #   - Display welcome message - 
                        */
                        var welcomeMsg = "🚀  Welcome to Seshi! 🚀\n\nLet's rock the boat...\n\n\nType Seshi.help() for help.. \n\n\n";
                        console.log(welcomeMsg);
                        return welcomeMsg;
                    })(),
    init:function(){
                        /* Initialise Seshi
                         *
                         * > Checks for existing Signaling Servers, adds Seshi.io as default
                         * > Updates local file list cache
                        */
                        
                        //Initalize local files list cache if empty
                        if (!localStorage.getItem("localFilesList" || localStorage.getItem('localFilesList').length == 0)) {
                            Seshi.updateLocalFilesList();
                        }//Load localFilesList if empty
                        //Populate signaling servers list (Seshi.signalingServers.list)
                        Seshi.signalingServers.buildList();
                        
                        //Add default Seshi.io Signaling server if none present
                        if ( Seshi.signalingServers.list.length == 0 ) {
                            Seshi.addSignalingServer("seshi.io");
                        }//End add default signaling server if none present
                        return "It's 106 miles to Chicago; We got a full tank of gas; half a pack of cigarettes; its dark, and we're wearing sunglasses. Let's go!";
    },
    help:function(){console.log("#\n" +
                        '# Usage:\n' + 
                        '#  Seshi.help() -- This menu\n' +
                        '#  Seshi.connectionStatus -- Returns object of peer connection state for iceConnectionState & dataChannelState\n'+
                        '#  Seshi.generateKey() -- Returns a key (string) to be used when setting up a peer connection. This getts passed to the signalingServer.\n' +
                        '#  Seshi.store({\'dataSource\':\'fileSystem || seshiChunk\',\'data\':this.files}) -- Store data into Seshi\'s Database\n' +
                        '#  Seshi.storeProgress -- Arrary indexed by fileId shows store progress e.g. for (var key in Seshi.storeProgress){Seshi.storeProgress[key];}\n'+
                        '#  Seshi.updateLocalFilesList() -- Refreshes the local file list\n' +
                        '#  Seshi.deleteFile(fileId) -- Delete file from Seshi\n' +
                        '#  Seshi.localFileList() -- Returns list of local files in Array of JSON objects\n' +
                        '#  Seshi.play(fileId, element) -- Playback a file (fileId) in your browser, attaching it as the src of (element) video or audio tag\n' + 
                        '#  Seshi.sendLocalFileListToRemote -- Send local filelist to peer. Peer automatically sends theirs back populating Seshi.remoteFileList\n' +
                        '#  Seshi.download() -- Download a given fileId to the users local filesystem.\n' +
                        '#  Seshi.remoteFileList  -- Returns list of connected peers files (when connected)\n' +
                        '#  Seshi.sendFileToPeer(fileId) -- Send a file to peer over DataChannel. Must specify local FileId\n' +
                        '#  Seshi.setBoxId(boxName) -- Set Seshi.boxId , (similar to the folder concept, but more just a name to refer to a collection of files.\n' +
                        '#  Seshi.getBoxId() -- Returns the current Seshi.boxId name under which files will be stored.\n' + 
                        '#  Seshi.syncData() -- Send all data to connecteed peer. This may take a while!\n' + 
                        '#  Seshi.addSignalingServer("example.com")  -- Add the address of additional signaling server(s)\n' + 
                        '#\n\n\n' +
                        '#  ## The rest if Seshi is still being wrapped into the `Seshi.<call>` api ##\n' +
                        '#  ## for better code quality and to help make building user interfaces a much cleaner experience. ##\n' + 
                        '#      These will probably be named:\n' + 
                        '#          > Seshi.call() -- For contacting signaling server(s)\n' + 
                        '#          > Seshi.connect() -- Establish connection between peers\n' +
                        '#          > Seshi.play() -- Returns blob url of file so UI can playback media. (see: https://goo.gl/mmPU9V)\n' 
            ); return "🚀 🚀  Keep calm & Seshi on! 🚀 🚀"},
    connect: function() {
                        /* Connect()
                         *
                         * Calls index.js Connect
                         * Crude call to older code.. 
                         *
                         * Connect() is used to establish the signalling channel. 
                         * Once established, call() can be executed to begin a datachannel connection.
                         */
                        connect();
    },
    call: function() {
                        /* 
                         * Call()
                         * - Creates and sets up the datachannel 
                         * (can only be done *after* a signalling channel is established
                         * using connect()
                         *
                         * Crude call to older code.. 
                         * */
                         call();
    },
    connectionStatus:{
                        iceConnectionState:function(){
                            if (typeof pc == "undefined") { 
                                return "Not Started. Use Seshi.connect() to begin a peer connection";
                            } else {
                                return pc.iceConnectionState}
                        },
                        dataChannelState:function(){
                            if (typeof dc == "undefined") { 
                                return "Not Started. Use Seshi.call() after initiating peer connection with Seshi.connect()"; 
                            } else { 
                                return dc.readyState }
                        }
                        
    },
    signalingStatus:'',
    getSignalingStatus: function() {
                        /* getSignalingStatus 
                        * Simply return current status of signaling connection
                        */
                        return Seshi.signalingStatus;
    },
    setSignalingStatus: function(statusMsg) {
                        /* setSignalingStatus()
                         * Set signalling status (upon a change in signaling) */
                        Seshi.signalingStatus = statusMsg;
    },
    key:'', //Connection key for two connecting peers
    setKey: function() {
                        /* Generate connection key 
                         * Used as key to pass to signaling server for connecting two peers
                        */
                        /* Cred: http://stackoverflow.com/a/1497512/885983 */
                        var length = 8,
                            charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                            retVal = "";
                        for (var i = 0, n = charset.length; i < length; ++i) {
                            retVal += charset.charAt(Math.floor(Math.random() * n));
                        }
                        Seshi.key = retVal;
                        return Seshi.getKey();
    },
    getKey: function() {
                        /* getKey()
                         * - Returns the current connection key 
                         */
                        return Seshi.key;
    },
    generateKey:function() {
    },
    connect: function() {
                        /* Seshi.Connect()
                        *   - Set up peer connection -
                        */
                        var errorCB, scHandlers, handleMsg;

                        // First, get the key used to connect
                        key = Seshi.getKey;
                        // This is the handler for all messages received on the
                        // signaling channel.
                        handleMsg = function (msg) {
                        // First, we clean up the message and post it on-screen
                        var msgE = document.getElementById("inmessages");
                        var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
                        msgE.value = msgString + "\n" + msgE.value;

                        // Then, we take action based on the kind of message
                        if (msg.type === "offer") {
                          pc.setRemoteDescription(new RTCSessionDescription(msg,
                                            function(){console.log("Sucess setRemoteDescription offer on connect()..");},
                                            function(){console.log("Failed setRemoteDescription offer on connect()...");}));
                          answer();
                        } else if (msg.type === "answer") {
                          pc.setRemoteDescription(new RTCSessionDescription(msg,
                                            function(){console.log("Sucess setRemoteDescription answer on connect..");},
                                            function(){console.log("Failed setRemoteDescription answer on connect...");}));
                        } else if (msg.type === "candidate") {
                          pc.addIceCandidate(
                            new RTCIceCandidate({sdpMLineIndex:msg.mlineindex,
                                                 candidate:msg.candidate}),
                                    function(){console.log("Add iceCandidate sucess on connect() call..");},
                                    function(){console.log("error accing iceCanditation on connect() call..");});
                        }
                        };

                        // handlers for signaling channel
                        scHandlers = {
                        'onWaiting' : function () {
                          Seshi.setSignalingStatus("Waiting");
                          // weWaited will be used for auto-call
                          weWaited = true;
                            //Get localDescription ready to send to Peer Signaling server
                            //pc.createOffer
                            function gotPeerDescription(localSDPOffer) {
                                    console.log("The Local SDP is: " + localSDPOffer);
                            }//End gotPeerDescription(localSDP)
                            //pc.createOffer(gotPeerDescription);
                        },
                        'onConnected': function () {
                          Seshi.setSignalingStatus("Connected");
                          // set up the RTC Peer Connection since we're connected
                          Seshi.createPC();
                        },
                        'onMessage': handleMsg
                        };

                        // Finally, create signaling channel
                        signalingChannel = Seshi.createSignalingChannel(key, scHandlers);
                        errorCB = function (msg) {
                        document.getElementById("response").innerHTML = msg;
                        };

                        // and connect.
                        signalingChannel.connect(errorCB);
    },
    createSignalingChannel:function(key, handlers) {
                        /* Create signalling channel 
                        * This function is called by Seshi.connect()
                        * Takes handlers to manage connection events, and
                        * Returns an object with two methods
                        * connect() & send() <<-- Connect is not to be 
                        * confused with Seshi.connect()
                        */


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

                          // open XHR and send the connection request with the key
                                 var client = new XMLHttpRequest();
                                 client.onreadystatechange = handler;
                                 client.open("GET", "http://signal.seshi.io/connect?key=" + key);
                                 client.send();
                    }//End connect()


                    // poll() waits n ms between gets to the server.  n is at 10 ms
                    // for 10 tries, then 100 ms for 10 tries, then 1000 ms from then
                    // on. n is reset to 10 ms if a message is actually received.
                    function poll() {
                      var msgs;
                      var pollWaitDelay = (function() {
                        var delay = 10, counter = 1;

                        function reset() {
                          delay = 10;
                          counter = 1;
                        }
                        function increase() {
                          counter += 1;
                          if (counter > 20) {
                            delay = 1000;
                          } else if (counter > 10) {
                            delay = 100;
                          }                          // else leave delay at 10
                        }

                        function value() {
                          return delay;
                        }

                        return {reset: reset, increase: increase, value: value};
                      }());

                      // getLoop is defined and used immediately here.  It retrieves
                      // messages from the server and then schedules itself to run
                      // again after pollWaitDelay.value() milliseconds.
                      (function getLoop() {
                        get(function (response) {
                          var i, msgs = (response && response.msgs) || [];

                          // if messages property exists, then we are connected   
                          if (response.msgs && (status !== "connected")) {
                            // switch status to connected since it is now!
                            status = "connected";
                            connectedHandler();
                          }
                          if (msgs.length > 0) {           // we got messages
                            pollWaitDelay.reset();
                            for (i=0; i<msgs.length; i+=1) {
                              handleMessage(msgs[i]);
                            }
                          } else {                         // didn't get any messages
                            pollWaitDelay.increase();
                          }

                          // now set timer to check again
                          setTimeout(getLoop, pollWaitDelay.value());
                        });
                      }());
                    } //End poll()



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

                      // open XHR and request messages for my id
                      var client = new XMLHttpRequest();
                      client.onreadystatechange = handler;
                      client.open("POST", "http://signal.seshi.io/get");
                      client.send(JSON.stringify({"id":id}));
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

                      // open XHR and send my id and message as JSON string
                      var client = new XMLHttpRequest();
                      client.onreadystatechange = handler;
                      client.open("POST", "http://signal.seshi.io/send");
                      var sendData = {"id":id, "message":msg};
                      client.send(JSON.stringify(sendData));
                    }

                    return {
                      connect:  connect,
                      send:  send
                    };
    },
    createPC:function() {
                        /* createPC()
                        * Create RTC peer connection (called by Seshi.onConnected)
                        *
                        */
                        var stunuri = true,
                        turnuri = false,
                        myfalse = function(v) {
                            return ((v==="0")||(v==="false")||(!v)); },
                        config = new Array();
                        queryparams = '';

                        // adjust config string based on any query params
                        if (queryparams) {
                            if ('stunuri' in queryparams) {
                                stunuri = !myfalse(queryparams['stunuri']);
                            }
                            if ('turnuri' in queryparams) {
                            turnuri = !myfalse(queryparams['turnuri']);
                            };
                        };

                        if (stunuri) {
                            // this is one of Google's public STUN servers
                            //config.push({"url":"stun:stun.l.google.com:19302"});
                            //config.push({"url":"stun:178.62.83.184:3478"});
                            config.push({"url":"turn:178.62.83.184:3478","username":"my_username","credential":"my_password"});
                        }
                      console.log("config = " + JSON.stringify(config));
                      window.pc = new RTCPeerConnection({iceServers:config});
                      window.pc.onicecandidate = Seshi.onIceCandidate;
                      window.pc.onaddstream = Seshi.onRemoteStreamAdded;
                      window.pc.onremovestream = Seshi.onRemoteStreamRemoved;
                      window.pc.ondatachannel = Seshi.onDataChannelAdded;
                      window.pc.oniceconnectionstatechange = Seshi.onIceconnectionStateChanged;
    },
    onIceCandidate: function(e) {
                        /* onIceCandidate(e) 
                        - When recived ice candidate from local browser,
                        *  Send it to peer. 
                        */
                        if (e.candidate) {
                            Seshi.send({type:  'candidate',
                            mlineindex:  e.candidate.sdpMLineIndex,
                            candidate:  e.candidate.candidate});
                        }
    },
    onRemoteStreamAdded: function(e) {
                        console.log("Remote stream was added!");
    },
    onIceconnectionStateChanged: function(e) {
                        console.log("Ice Connection State Change to: " + pc.iceConnectionState);
    },
    onDataChannelAdded: function(e) {
                        /* onDataChannelAdded(e) 
                         *  - When datachannel comes up
                        */
                        statusE = document.getElementById("status"),
                        statusE.innerHTML = "We are connected!";
                        dc = e.channel;
                        console.log("We are connected!");
                        //sendMostRecentFile();
                        Seshi.setupDataHandlers();
                        sendChat("Yolo! Seshi Init.");

                        e.channel.onopen = function(){
                            //Request file listing from remote peer
                            Seshi.sendLocalFileListToRemote();
                        }//Once datachannel is open, send over local file listing

    },
    send: function() {
                        /* send() 
                        * - Send a message over the signalling channel (not peer to peer)
                        */
                        var handler = function (res) {
                            document.getElementById("response").innerHTML = res;
                            return;
                        },

                        // Get message if not passed in
                        msg = msg || document.getElementById("message").value;

                        // Clean it up and post it on-screen
                        msgE = document.getElementById("outmessages");
                        var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
                        msgE.value = msgString + "\n" + msgE.value;

                        // and send on signaling channel
                        signalingChannel.send(msg, handler);
    },
    call: function() {
                        /* call()
                        * - Can only bee called once connected (when both peers know how to find each other) 
                        * - Create a datachannel connection between them
                        */
                        dc = pc.createDataChannel('chat');
                        Seshi.setupDataHandlers();
                        pc.createOffer(Seshi.gotDescription, doNothing, constraints);
    },
    setupDataHandlers: function() {
                        /* setupDataHandlers()
                        * - Sets up the datachannal message & I/O handling
                        *
                        */
    data.send = function(msg) {
        msg = JSON.stringify(msg);
        console.log("Sending: " + msg + " over data channel");
        dc.send(msg);
    }
    dc.onmessage = function(event) {
    statusE = document.getElementById("status"),
    statusE.innerHTML = "We are connected!";

        trace('Received Message: ' + event.data);

        if ( event.data instanceof Array ) {
                alert('Is array');
        }

        //Check if message is an array buffer (data)
        if(event.data instanceof ArrayBuffer || event.data.size){ //event.data.size is for Firefox(automatically transforms data to Blob type
            console.log('Recieved ArrayBuffer message');
            //Catch ArrayBuffer sent through the datachannel
            var blob = new Blob([event.data]);

/* Change this to read the lengthOfMeta, which is always at the start of the blob and is 64 bytes long.
We might need to reduce the size of the chunks for this to work over STCP!!!
#########*/
                //Get length of file meta (size specified is always a zerofilled 64byte long string at the begining of the blob
                var metaLength = blob.slice(0,81);

                //Read metaLength to get size in bytes of chunk fileMeta
                var reader2 = new FileReader();
                reader2.onload = function(file2) {
                        if ( reader2.readyState == FileReader.DONE ) {
                                result2 = file2.target.result;
                                var fileMetaLengthObj = JSON.parse(result2);
                                var fileMetaLength = parseInt(fileMetaLengthObj.metaLength);
                                window.fileMetaLength = fileMetaLength;
                                console.log("Meta length is:" + fileMetaLength);
                                    //Split file meta from begining of chunk (all chunk payloads are 64512 bytes in length)
                                    var chunkFileMeta = blob.slice(81, window.fileMetaLength + 81); //First get file type, chunk number etc
                                        var reader = new FileReader();
                                        reader.onload = function(file) {
                                                if ( reader.readyState == FileReader.DONE ) {
                                                        result = file.target.result;
                                                        if ( result.length > 0 ) {
                                                                window.curChunk = JSON.parse(result);
                                                                //Update window with current chunk information
                                                                var chunkProgresTextBox = document.getElementById('chunkInProgress');
                                                                var message = "File id: " + curChunk.fileId + " ChunkNumber: ";
                                                                message += curChunk.chunkNumber + " Filetype: " + curChunk.fileType;
                                                                message += " FileName: " + curChunk.fileName;
                                                                chunkProgresTextBox.value = message;

                                var chunkProg = (curChunk.chunkNumber + 1) / curChunk.numberOfChunks * 100;
                                //Update user facing status box
                                if (chunkProg == 100)
                                {
                                    statusMsg = 'Complete!: "' + curChunk.fileName + ' 100%';
                                } else {
                                    statusMsg = 'Reciving file: "' + curChunk.fileName + '" Chunk number: ' + curChunk.chunkNumber;
                                }
                                statusE = document.getElementById("status"),
                                statusE.innerHTML = statusMsg;
                                                                //End extract file meta from blob
                                                        }//End check read data is > 0
                                                                //Start send data payload
                                                                var headerOffset = 81 + window.fileMetaLength;
                                                                var chunkBlob = blob.slice(headerOffset); //Get chunk payload
                                                                //Store chunkBlob into IndexedDB
                                                                addChunkToDb(chunkBlob);
                                                                //Create ObjectURL to recieved chunk (pointless!! It's only a chunk...testing)
                                                                var url = window.URL.createObjectURL(chunkBlob);
                                                                console.log(url);
                                                               //End send data chunk payload
                                                }//End reader.readtState == DONE
                                        }//End reader.onload
                                        reader.readAsText(chunkFileMeta);
                                        //End extract file meta from blob          


                        }//End IF reading byte lenth of fileMeata
                }//End get bytelength of fileMeta
                reader2.readAsText(metaLength);


        } else { //If not an ArrayBuffer , treat as control packet.
            if(JSON.parse(event.data))
            { 
                fileMeta = JSON.parse(event.data);
                console.log('Got file meta');
            }
        }//End determin if data message or control message.  



        //Don't JSON.parse is data is already an object ;) 
        if ( typeof event.data != "object" ) {
                var msg = JSON.parse(event.data);
        } else {
                var msg = event.data;
        }//End don't parse data message recived if already an object!
        cb = document.getElementById("chatbox");
        rtt = document.getElementById("rtt");


        //Command & control
        //Check for remote calls (ie file listing requests) risky!
        if(msg.cmd) {
            console.log("Interpreting command from remote peer..");
            switch (msg.cmd) {
                case 'sendLocalFileListToRemote': //Request from peer to see filelist
                    Seshi.sendLocalFileListToRemote(); //Local peer sends its local file lsit to remote 
                    break;
                case 'recvRemoteFileList': //Receiving list of files from remote peer
                    Seshi.recvRemoteFileList(msg);
                    break;
            }//Switch on comman requested by remote peer
        }//End check for command & control message from remote peer

        //Realtime chat
        if(msg.rtt) {
        // if real-time-text (per keypress) message, display in 
        // real-time window 
        console.log("received rtt of '" + msg.rtt + "'");
        rtt.value = msg.rtt; msg = msg.rtt;
        } else if (msg.requestFileId) {

                console.log("Request for file recieved.");
                //sendFileToPeer(msg.requestFileId);

        } else if (msg.chat) {
            // if full message, display in chat window,
            // reset real-time window,
            // and force chat window to last line 
            console.log("received chat of '" + msg.chat + "'");
            cb.value += msg.chat + "\n";
            cb.scrollTop = cb.scrollHeight; msg = msg.chat;
            } else if (msg.storeData) {
                console.log("Received data store message.");
                //console.log(blobURL);

            } else {
                console.log("received " + msg + "on data channel");
                }
                };
    },
    gotDescription: function(localDesc) {
                        /* gotDescription() 
                        *  Once browser has generated session description,
                        * send this local description to the other browser along 
                        * with any constraints.
                        */
                        console.log("Local Description type: " + localDesc.type);
                        console.log("Local Description sdp: " + localDesc.sdp);
                        pc.setLocalDescription(localDesc,
                                    function(){console.log("Sucess setLocalDescription...");},
                                    function(error){console.log("Failed setLocalDescription...");});
                        Seshi.send(localDesc);
    },
    updateLocalFilesList: function() {
                        /* 
                        #   UpdateLocalFilesList() 
                        #   - Refreshes Seshi's list of local files cache -
                        #   
                        #   Calls a worker, defined in js/getLocalFilesList.js
                        #   The worker queries IndexedDB for the latest list of files.
                        #   This takes time (hence the cache)
                        #   When done, the worker posts a message back to Seshi
                        #   containing the most up-to-date list of files as an array 
                        #   of objects. Seshi updates it's 'cache' of the latest file 
                        #   list by Appending the list to Seshi.getLocalFileList. 
                        */
                        var promise = new Promise (function(resolve, reject) {
                            var LocalFilesListWorker= new Worker('js/workers/getLocalFilesList.js');
                            LocalFilesListWorker.postMessage({'cmd':'listFilesMeHearty'});
                            //Act of response from worker (the list of files)
                            LocalFilesListWorker.onmessage = function(event) {
                                console.log("Updating list of local files. Type: Seshi.localFileList for updated list");
                                resolve(localStorage.setItem("localFilesList", JSON.stringify(event.data.fileList)));
                            }
                        });
                            return promise;
                       },
    deleteFile:function(){
                        /* Delete File From Seshi database given fileId */
                      db.chunks.where("fileId").equals(fileId).delete()
                      .then(function(deleteCount) {
                        console.log("Deleted: " + deleteCount + " chunks. Of fileId: " + fileId );
                        Seshi.updateLocalFilesList(); //Update local filelist cache
                      });  
    },
    localFileList:function() {
                        /* Returns cached local files list from localstorage as array of JSON objects */
                        return JSON.parse(localStorage.getItem('localFilesList'));
                        },
    remoteFileList:[]   /* Returns cached list of remote peer's files as an array of JSON objects */,
    recvRemoteFileList:function(remoteFileList) {
        console.log("Received list of files from connected peer.");
        //Attach remote peers file listing to Seshi.remoteFileList object
        Seshi.remoteFileList = JSON.parse(remoteFileList.data);
        msg = JSON.stringify({'chat':'SeshiBOT: Sucesfully recived your list of files, ta!\nSending mine now..'});
        dc.send(msg);
        if (!remoteFileList.reply) 
        {   
            console.log("Replying back to peer with own local file listing...");
            Seshi.sendLocalFileListToRemote(reply=true);//Send own localFilesList back to remote peer that sent theirs
        }//End send back own local files list if havn't already sent it
    },
    store:function(dataSourceMsg) {
                        /* Store() data into Seshi's Indexed DB
                         #  
                         # 'dataSourceMsg' should be given in the following format:
                         #
                         #  {
                         #      "dataSource":"fileSystem || seshiChunk",
                         #      "data":"File object || Seshi ArrayBuffer packet
                         #  }
                         #
                         #  If dataSource is 'fileSystem' then 'data' should be a File 
                         #  list object (https://developer.mozilla.org/en/docs/Web/API/FileList)
                         #  each file in the file list object will then be chunked & stored 
                         #  into Seshi's IndexedDB using the web worker storeFileDexieWorker.js
                         #
                         #  If dataSource is 'seshiChunk', it should be a Seshi chunk of type 
                         #  arrayBuffer. Each chunk will be stored directly into Seshi's 
                         #  IndexedDB using the web worker storeFileDexieWorker.js
                        */
                        var StorageWorker = new Worker("js/workers/storeFileDexieWorker.js");
                        StorageWorker.postMessage(dataSourceMsg); // Post data to worker for storage
                        //Recieve proress message(s)
                        StorageWorker.onmessage = function(event) {
                            var progressData = event.data;
                            //Update Seshi.storeProgess array with file storing progress updates, indexeded by fileId
                            Seshi.storeProgress[progressData.fileId] = {
                                "fileName":progressData.fileName,
                                "currentChunk":progressData.currentChunk,
                                "totalNumChunks":progressData.totalNumChunks,
                                "complete":progressData.currentChunk == progressData.totalNumChunks ? true:false
                                }
                        }//End recieve storage progress update and update Seshi.storeProgress array with fileId's progress
    },
    storeProgress:[],
    sendLocalFileListToRemote:function(bool) {
        console.log("Should send my file list now over datachannel to peer..");
        //Send most up to date file listing or cached version?? hmm.
        //Prepare file list message to send to remote peer
        localFileList = JSON.stringify(Seshi.localFileList());
        msg = {"cmd":"recvRemoteFileList", "data":localFileList, "reply":bool};
        msg = JSON.stringify(msg);
        dc.send(msg);
    },
    play:function(fileId, playerId) {
                        /* Playback requested fileId to user
                         * - Updates video or audio `src` attribute of playerId and starts playback -
                         * TODO move Seshi.play to a streaming web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            //Transaction scope
                            db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                                    console.log("Found " + chunks.length + " chunks");
                                    var allChunksArray = [];
                                    //Just get blob cunks (without meta info)
                                    for(var i=0;i<chunks.length; i++){
                                        allChunksArray[i] = chunks[i].chunk
                                    }//End put all chunks into all chunks array
                                    var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                    console.log(chunks[0].fileType);
                                    url = window.URL.createObjectURL(file);
                                    console.log("Data: " + url);
                                    var video = document.getElementById(playerId);
                                    var obj_url = window.URL.createObjectURL(file);
                                    video.src = obj_url;
                                    video.addEventListener('canplay', function() {
                                        if ( video.readyState == 4 ) {
                                            video.play();
                                        }
                                    })//End playback media when ready
                                    //Simply download file if on mobiles
                                    if( window.screen.width < 700 ) {
                                        alert("We're working hard on mobile playback. Support Seshi with a pro account to fund development!");
                                    }//End display mobile playback message.
                            }).catch (function (err) {
                                console.error(err);
                            })});//End get file chunks from fileId and playback
    },
    download:function(fileId) {
                        /* Download 
                        * - Download a given fileId from Seshi's database to the system's filesystem boo.
                        * TODO move Seshi.download job to a web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                                console.log("Found " + chunks.length + " chunks");
                                var allChunksArray = [];
                                //Just get blob cunks without meta
                                for(var i=0;i<chunks.length; i++){
                                    allChunksArray[i] = chunks[i].chunk
                                }//End put all chunks into all chunks array
                                //Build file blob out of chunks and send to users browser for download.
                                var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                console.log(chunks[0].fileType);
                                url = window.URL.createObjectURL(file);
                                console.log("Data: " + url);
                                var a = document.createElement("a");
                                document.body.appendChild(a);
                                a.style = "display: none";
                                a.href = url;
                                a.download = chunks[0].fileName;
                                a.click();
                            })//End db.chunks toArray using Dexie (.then follows)
                        }).then(function() {
                            //Transaction completed
                        }).catch (function (err) {
                            console.error(err);
                        });//End get fildIdChunks from fileId
    },
    sendFileToPeer:function(fileId) {
                        /* Sends given file (fieId) over Datachannel to connected peer
                         * For each chunk found, send over data channel until 'last chunk'* has been sent.
                         * The following comments require multipeer (TODO)
                         *  > *Not all peers will have all chunks to the file, some may only have a subset. 
                         *  > Close the connection? no. 
                         *  > Exchange useful data: 
                         *      Share known signaling servers, peer exchange, file lists (names), boxIds
                        */
                        
                        //Check Datachannel connection status
                        if (typeof dc == "undefined" || dc.readyState != "open") {
                            console.error("Seshi.sendFileToPeer(fileId) Tried to send file to peer but Datachannel is not open");
                            return false;
                        }//End check Datachannel is actually open

                        db.transaction('r', db.chunks, function() {
                            db.chunks.where("fileId").equals(fileId).each(function(chunk) {
                            //Transaction scope
                            //Sending file meta...
                            var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                            var lengthOfMeta = JSON.stringify(meta).length;
                            lengthOfMeta = zeroFill(lengthOfMeta, 64);
                            var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified 
                            var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                            var sendChunk = new Blob([header, chunk.chunk]);
                            //Needs to be sent as an arrayBuffer
                            var reader = new FileReader();
                            reader.onload = function(file) {
                                if( reader.readyState == FileReader.DONE ) {
                                        for(var i=0;i<=99999999;i++) {}//Crude delay!
                                        dc.send(result = file.target.result);
                                }//End FileReader.DONE
                            }//End reader.onload
                            reader.readAsArrayBuffer(sendChunk);
                            //Update sendingFileProgress
                            Seshi.sendingFileProgress.percentComplete= (chunk.chunkNumber + 1) / chunk.numberOfChunks * 100;
                            Seshi.sendingFileProgress.fileName = chunk.fileName;
                            Seshi.sendingFileProgress.fileId = chunk.fileId;
                            Seshi.sendingFileProgress.fileType = chunk.fileType;
                            Seshi.sendingFileProgress.chunkNumber = chunk.chunkNumber;
                            Seshi.sendingFileProgress.numberOfChunks = chunk.numberOfChunks;
                            }).then(function(){
                            Seshi.sendingFileProgress.allFileDataSent = true;
                            })});
    },
    sendingFileProgress:{"fileId":'',"fileName":'', "fileType":'',"numberOfChunks":'',"chunkNumber":'',"percentComplete":'',"allFileDataSent":''},
    addSignalingServer:function(signallingServerAddress){
                            /* - Add a signaling server to Seshi - */
                            //Check dosen't already exist
                            signalServerDb.signalServers.where("address").equalsIgnoreCase("seshi.io").
                                count(function(num){ 
                                    if (num == 0) {//If entry dosn't already exist, add to indexedDB
                                        signalServerDb.signalServers.add({address: signallingServerAddress,
                                        lastSuccessfulConnectTimestamp: null,
                                        lastConnectAttempTimestamp: null,
                                        numFailedConnectAttempts: null}).
                                        then(function(){
                                        console.log('Successfully Inserted signaling server "' + signallingServerAddress + '"');
                                        }).catch(function(error) {
                                        console.error(error);
                                        });//End insert new singalingServerAddress
                                    }
                                })
    },
    signalingServers:{
            list:[],
            buildList:function(){
                    signalServerDb.transaction('r', signalServerDb.signalServers, function()

                    {signalServerDb.signalServers.each(function(signalServer) {
                            Seshi.signalingServers.list.push(signalServer);
                        })
                    })
                }
    },
    syncData:function(){
            /* Send all data to connected peer 
             * This is currently very intensive as it does not (yet) make use of the worker
             * TODO ^above^
            */
            db.transaction('r', db.chunks, function() {
                db.chunks.each(function(chunk) {//Transaction scope
                    //Get file meta for chunk header...
                    var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                    var lengthOfMeta = JSON.stringify(meta).length;
                    lengthOfMeta = zeroFill(lengthOfMeta, 64);
                    var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified 
                    var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                    var sendChunk = new Blob([header, chunk.chunk]);
                    //Needs to be sent as an arrayBuffer
                    var reader = new FileReader();
                            reader.onload = function(file) {
                            if( reader.readyState == FileReader.DONE ) {
                                    for(var i=0;i<=99999999;i++) {}//Crude delay!
                                    dc.send(result = file.target.result);
                            }//End FileReader.DONE
                    }//End reader.onload
                    reader.readAsArrayBuffer(sendChunk);
                })//End db.chunks toArray using Dexie
            }).then(function() {
                console.log("All chunks (all files) sent to connected peer!");//Transaction completed
            }).catch (function (err) {
                console.error(err);
            });//End log errors from sending all data to peer
},
setBoxId:function(boxName) {
            /* Set boxId
            * A box is similar to the folder concept.
            * Used to organise files stored in Seshi in some fashion
            * e.g. Allow user to store files under a certain box name
            * then query Seshi for files the key path of a given <boxId>
            */
            Seshi.boxId = boxName;
            return "Seshi.boxId is now set to: " + Seshi.boxId;
},
getBoxId:function(){return Seshi.boxId;},
boxId:'myBoxID',//Defaults to myBoxId
trace: function(text) {
            /* trace() 
            * logging with timestamp
            */ 
            if (text[text.length - 1] == '\n') {
                text = text.substring(0, text.length - 1);
            }
            console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}
}//End Seshi :'(

Seshi.init();


///////////////////////////////////////////////////////////////
//
//
//          Index.js 
//
//
//////////////////////////////////////////////////////////////

function showDebugInfo() {
        var debugElms = document.getElementsByClassName('debug');
        for ( i=0;i<debugElms.length; i++) {
                debugElms[i].className="debug";
        }
}//End showDebugInfo

var signalingChannel, key, id,
    weWaited = false,
    doNothing = function() {},
    pc, dc, data = {},
    constraints = {},
    fileMeta = {};


// auto-connect signaling channel if key provided in URI
if (queryparams && queryparams['key']) {
document.getElementById("key").value = queryparams['key'];
connect();
}



function connectedToPeer(e) {
        console.log("Great. Connected to peer via peer signaling channel, probably.");
        setStatus("Connected");
        // set up the RTC Peer Connection since we're connected
}//End  

////////////////////////////
// This is the main routine.
////////////////////////////


/////////////////////
// This section is for setting up the signaling channel.
/////////////////////

// This routine connects to the web server and sets up the
// signaling channel.  

function connect() {
  var errorCB, scHandlers, handleMsg;

  // First, get the key used to connect
  key = Seshi.getKey();
  // This is the handler for all messages received on the
  // signaling channel.
  handleMsg = function (msg) {
    // First, we clean up the message and post it on-screen
    var msgE = document.getElementById("inmessages");
    var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
    msgE.value = msgString + "\n" + msgE.value;

    // Then, we take action based on the kind of message
    if (msg.type === "offer") {
      pc.setRemoteDescription(new RTCSessionDescription(msg,
                        function(){console.log("Sucess setRemoteDescription offer on connect()..");},
                        function(){console.log("Failed setRemoteDescription offer on connect()...");}));
      answer();
    } else if (msg.type === "answer") {
      pc.setRemoteDescription(new RTCSessionDescription(msg,
                        function(){console.log("Sucess setRemoteDescription answer on connect..");},
                        function(){console.log("Failed setRemoteDescription answer on connect...");}));
    } else if (msg.type === "candidate") {
      pc.addIceCandidate(
        new RTCIceCandidate({sdpMLineIndex:msg.mlineindex,
                             candidate:msg.candidate}),
                function(){console.log("Add iceCandidate sucess on connect() call..");},
                function(){console.log("error accing iceCanditation on connect() call..");});
    }
  };

  // handlers for signaling channel
  scHandlers = {
    'onWaiting' : function () {
      setStatus("Waiting");
      // weWaited will be used for auto-call
      weWaited = true;
        //Get localDescription ready to send to Peer Signaling server
        //pc.createOffer
        function gotPeerDescription(localSDPOffer) {
                console.log("The Local SDP is: " + localSDPOffer);
        }//End gotPeerDescription(localSDP)
        //pc.createOffer(gotPeerDescription);
    },
    'onConnected': function () {
      setStatus("Connected");
      // set up the RTC Peer Connection since we're connected
      createPC();
    },
    'onMessage': handleMsg
  };

  // Finally, create signaling channel
  signalingChannel = createSignalingChannel(key, scHandlers);
  errorCB = function (msg) {
    document.getElementById("response").innerHTML = msg;
  };

  // and connect.
  signalingChannel.connect(errorCB);
}


// This routine sends a message on the signaling channel, either
// by explicit call or by the user clicking on the Send button.
function send(msg) {
  var handler = function (res) {
    document.getElementById("response").innerHTML = res;
    return;
  },

  // Get message if not passed in
  msg = msg || document.getElementById("message").value;

  // Clean it up and post it on-screen
  msgE = document.getElementById("outmessages");
  var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
  msgE.value = msgString + "\n" + msgE.value;

  // and send on signaling channel
  signalingChannel.send(msg, handler);
}


//////////////////////////////
// This next section is for setting up the RTC Peer Connection
//////////////////////////////

function createPC() {
  var stunuri = true,
      turnuri = false,
      myfalse = function(v) {
                  return ((v==="0")||(v==="false")||(!v)); },
      config = new Array();
          queryparams = '';

  // adjust config string based on any query params
  if (queryparams) {
    if ('stunuri' in queryparams) {
      stunuri = !myfalse(queryparams['stunuri']);
    }
    if ('turnuri' in queryparams) {
      turnuri = !myfalse(queryparams['turnuri']);
    };
  };

  if (stunuri) {
    // this is one of Google's public STUN servers
    //config.push({"url":"stun:stun.l.google.com:19302"});
    //config.push({"url":"stun:178.62.83.184:3478"});
    config.push({"url":"turn:178.62.83.184:3478","username":"my_username","credential":"my_password"});
  }
  console.log("config = " + JSON.stringify(config));

  window.pc = new RTCPeerConnection({iceServers:config});
  window.pc.onicecandidate = onIceCandidate;
  window.pc.onaddstream = onRemoteStreamAdded;
  window.pc.onremovestream = onRemoteStreamRemoved;
  window.pc.ondatachannel = onDataChannelAdded;
  window.pc.oniceconnectionstatechange = onIceconnectionStateChanged;
  // wait for local media to be ready
  attachMediaIfReady();
}

// When our browser has another candidate, send it to the peer
function onIceCandidate(e) {
  if (e.candidate) {
        
        send({type:  'candidate',
                mlineindex:  e.candidate.sdpMLineIndex,
                candidate:  e.candidate.candidate});
        }
}

// When our browser detects that the other side has added the
// media stream, show it on screen
function onRemoteStreamAdded(e) {
  setStatus("On call");
}

// When browser alerts of change to Ice connection state
function onIceconnectionStateChanged(e) {
    console.log("Ice Connection State Change to: " + pc.iceConnectionState);
}//End onIceconnectionStateChanged

// Yes, we do nothing if the remote side removes the stream.
function onRemoteStreamRemoved(e) {}

//When our browser detects that the other side has added the
//data channel, save it, set up handlers, and send welcome
// message
function onDataChannelAdded(e) {
    statusE = document.getElementById("status"),
    statusE.innerHTML = "We are connected!";
    dc = e.channel;
    console.log("We are connected!");
    //sendMostRecentFile();
    setupDataHandlers();
    sendChat("Yolo! Seshi Init.");
    
    e.channel.onopen = function(){
        //Request file listing from remote peer
        Seshi.sendLocalFileListToRemote();
    }//Once datachannel is open, send over local file listing
}


//Set up the datachanner message handler
function setupDataHandlers() {
    data.send = function(msg) {
        msg = JSON.stringify(msg);
        console.log("Sending: " + msg + " over data channel");
        dc.send(msg);
    }
    dc.onmessage = function(event) {
	statusE = document.getElementById("status"),
	statusE.innerHTML = "We are connected!";

        trace('Received Message: ' + event.data);

        if ( event.data instanceof Array ) {
                alert('Is array');
        }

        //Check if message is an array buffer (data)
        if(event.data instanceof ArrayBuffer || event.data.size){ //event.data.size is for Firefox(automatically transforms data to Blob type
            console.log('Recieved ArrayBuffer message');
            //Catch ArrayBuffer sent through the datachannel
            var blob = new Blob([event.data]);

/* Change this to read the lengthOfMeta, which is always at the start of the blob and is 64 bytes long.
We might need to reduce the size of the chunks for this to work over STCP!!!
#########*/
                //Get length of file meta (size specified is always a zerofilled 64byte long string at the begining of the blob
                var metaLength = blob.slice(0,81);

                //Read metaLength to get size in bytes of chunk fileMeta
                var reader2 = new FileReader();
                reader2.onload = function(file2) {
                        if ( reader2.readyState == FileReader.DONE ) {
                                result2 = file2.target.result;
                                var fileMetaLengthObj = JSON.parse(result2);
                                var fileMetaLength = parseInt(fileMetaLengthObj.metaLength);
                                window.fileMetaLength = fileMetaLength;
                                console.log("Meta length is:" + fileMetaLength);

                                    //Split file meta from begining of chunk (all chunk payloads are 64512 bytes in length)
                                    var chunkFileMeta = blob.slice(81, window.fileMetaLength + 81); //First get file type, chunk number etc
                                        var reader = new FileReader();
                                        reader.onload = function(file) {
                                                if ( reader.readyState == FileReader.DONE ) {
                                                        result = file.target.result;
                                                        if ( result.length > 0 ) {
                                                                window.curChunk = JSON.parse(result);
                                                                //Update window with current chunk information
                                                                var chunkProgresTextBox = document.getElementById('chunkInProgress');
                                                                var message = "File id: " + curChunk.fileId + " ChunkNumber: ";
                                                                message += curChunk.chunkNumber + " Filetype: " + curChunk.fileType;
                                                                message += " FileName: " + curChunk.fileName;
                                                                chunkProgresTextBox.value = message;
                                                                
								var chunkProg = (curChunk.chunkNumber + 1) / curChunk.numberOfChunks * 100;
								//Update user facing status box
								if (chunkProg == 100)
								{
									statusMsg = 'Complete!: "' + curChunk.fileName + ' 100%';
								} else {
									statusMsg = 'Reciving file: "' + curChunk.fileName + '" Chunk number: ' + curChunk.chunkNumber;
								}
								statusE = document.getElementById("status"),
								statusE.innerHTML = statusMsg;
                                                                //End extract file meta from blob
                                                        }//End check read data is > 0
                                                                //Start send data payload
                                                                var headerOffset = 81 + window.fileMetaLength;
                                                                var chunkBlob = blob.slice(headerOffset); //Get chunk payload
                                                                //Store chunkBlob into IndexedDB
                                                                addChunkToDb(chunkBlob);
                                                                //Create ObjectURL to recieved chunk (pointless!! It's only a chunk...testing)
                                                                var url = window.URL.createObjectURL(chunkBlob);
                                                                console.log(url);
                                                                //End send data chunk payload
                                                }//End reader.readtState == DONE
                                        }//End reader.onload
                                        reader.readAsText(chunkFileMeta);
                                        //End extract file meta from blob          

                                
                        }//End IF reading byte lenth of fileMeata
                }//End get bytelength of fileMeta
                reader2.readAsText(metaLength);


        } else { //If not an ArrayBuffer , treat as control packet.
            if(JSON.parse(event.data))
            {   
                fileMeta = JSON.parse(event.data);
                console.log('Got file meta');
            }
        }//End determin if data message or control message.  

        

        //Don't JSON.parse is data is already an object ;) 
        if ( typeof event.data != "object" ) {
                var msg = JSON.parse(event.data);
        } else {
                var msg = event.data;
        }//End don't parse data message recived if already an object!
        cb = document.getElementById("chatbox");
        rtt = document.getElementById("rtt");
    

        //Command & control
        //Check for remote calls (ie file listing requests) risky!
        if(msg.cmd) {
            console.log("Interpreting command from remote peer..");
            switch (msg.cmd) {
                case 'sendLocalFileListToRemote': //Request from peer to see filelist
                    Seshi.sendLocalFileListToRemote(); //Local peer sends its local file lsit to remote 
                    break;
                case 'recvRemoteFileList': //Receiving list of files from remote peer
                    Seshi.recvRemoteFileList(msg);
                    break;
            }//Switch on comman requested by remote peer
        }//End check for command & control message from remote peer

        //Realtime chat
        if(msg.rtt) {
        // if real-time-text (per keypress) message, display in 
        // real-time window 
        console.log("received rtt of '" + msg.rtt + "'"); 
        rtt.value = msg.rtt; msg = msg.rtt; 
        } else if (msg.requestFileId) {

                console.log("Request for file recieved.");
                //sendFileToPeer(msg.requestFileId);

        } else if (msg.chat) { 
            // if full message, display in chat window,
            // reset real-time window,
            // and force chat window to last line 
            console.log("received chat of '" + msg.chat + "'");
            cb.value += msg.chat + "\n"; 
            cb.scrollTop = cb.scrollHeight; msg = msg.chat;
            } else if (msg.storeData) {
                console.log("Received data store message.");
                //console.log(blobURL);

            } else { 
                console.log("received " + msg + "on data channel");
                } 
                };
    }

function sendChat(msg) {
	var cb = document.getElementById("chatbox"),
	c = document.getElementById("chat");

	//Display message locally, send it, and force chat window to 
	// last line
	msg = msg || c.value;
	console.log("calling sendChat(" + msg + ")");
	cb.value += "-> " + msg + "\n";
	data.send({'chat':msg});
	c.value = '';
	cb.scrollTop = cb.scrollHeight;
}





function zeroFill( number, width )
{
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
}//End zeroFill

function sendChunksToPeer(e, fileId) {
        //Get file id else defaults to most recent file added
        if(typeof(e) == 'object')
        {
            var fileId = e.target.dataset.fileid;
        }

    db.transaction('r', db.chunks, function() {
            db.chunks.where("fileId").equals(fileId).each(function(chunk) {
                //Transaction scope
                        //Sending file meta...
                        var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                        var lengthOfMeta = JSON.stringify(meta).length;
                        lengthOfMeta = zeroFill(lengthOfMeta, 64);
                        var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified 
                        var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                        var sendChunk = new Blob([header, chunk.chunk]);
                        url = window.URL.createObjectURL(sendChunk);
                        //Needs to be sent as an arrayBuffer
                        var reader = new FileReader();
                                reader.onload = function(file) {
                                if( reader.readyState == FileReader.DONE ) {
                                        for(var i=0;i<=99999999;i++) {}//Crude delay!
                                        dc.send(result = file.target.result);
                                }//End FileReader.DONE

                        }//End reader.onload
                        reader.readAsArrayBuffer(sendChunk);
			var chunkProg = (chunk.chunkNumber + 1) / chunk.numberOfChunks * 100;
                        //End sending file meta
            })//End db.chunks toArray using Dexie (.then follows)

        }).then(function() {
            //Transaction completed
	    var uploadBar = document.getElementById('uploadProgress');
	    uploadBar.innerHTML="<span style=\"color:black\">UploadComplete!</span>";
        }).catch (function (err) {

            console.error(err);

    });//End get fildIdChunks from fileId

} //End sendChunksToPeer



function sendMostRecentFile() {
	//Get most recently added file (stored in localstorage.getItem('lastItem'))
	if(localStorage.getItem('lastItem'))
	{
	    fileId = localStorage.getItem('lastItem');
	    sendChunksToPeer('send by fileId', fileId); //Send file direct to peer over DC
	}//Only send last item if localStorage.getItem('lastItem') has a fileId
}


function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}


function addChunkToDb(blob) {
        //Add chunks to indexedDB
        db.transaction("rw", db.chunks, function() {
        var test = blob;
        console.log("Storing chunk number: " + window.curChunk.chunkNumber);
        db.chunks
            .add({
                boxId: window.boxId,
                chunk: blob,
                chunkNumber: window.curChunk.chunkNumber,
                chunkSize: window.curChunk.chunkSize,
                fileId: window.curChunk.fileId,
                fileName: window.curChunk.fileName,
                fileType: window.curChunk.fileType,
                numberOfChunks: window.curChunk.numberOfChunks
            });
        }).then(function() {
        //Transaction completed
        console.log('Time to show file back to user/recipricant..?');
    }).catch(function(error) {
        //Transaction failed
        console.log(error);
    });

}//End addChunkToDb



///////////////////////////////////
// This next section is for attaching local media to the Peer
// Connection.
///////////////////////////////////

// This guard routine effectively synchronizes completion of two
// async activities:  the creation of the Peer Connection and
// acquisition of local media.
function attachMediaIfReady() {
  // If RTCPeerConnection is ready and we have local media,
  // proceed.
  if (pc) {attachMedia();}
}

// This routine adds our local media stream to the Peer
// Connection.  Note that this does not cause any media to flow.
// All it does is to let the browser know to include this stream
// in its next SDP description.
function attachMedia() {
  
  setStatus("Ready for call");
}


////////////////////////////
// This next section is for calling and answering
////////////////////////////

// This generates the session description for an offer
function call() {
  dc = pc.createDataChannel('chat');
  setupDataHandlers();
  pc.createOffer(gotDescription, doNothing, constraints);
}

// and this generates it for an answer.
function answer() {
  pc.createAnswer(gotDescription, doNothing, constraints);
}

// In either case, once we get the session description we tell
// our browser to use it as our local description and then send
// it to the other browser.  It is the setting of the local
// description that allows the browser to send media and prepare
// to receive from the other side.
function gotDescription(localDesc) {
  console.log("Local Description type: " + localDesc.type);
  console.log("Local Description sdp: " + localDesc.sdp);
  pc.setLocalDescription(localDesc,
                function(){console.log("Sucess setLocalDescription...");},
                function(error){console.log("Failed setLocalDescription...");});
  send(localDesc);
}

window.uuid = function()
{   /* Credit http://stackoverflow.com/a/2117523 */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
    });
}

////////////////////////////////////
// This section is for changing the UI based on application
// progress.
////////////////////////////////////

// This function hides, displays, and fills various UI elements
// to give the user some idea of how the browser is progressing
// at setting up the signaling channel, getting local media,
// creating the peer connection, and actually connecting
// media (calling).
function setStatus(str) {
  var statuslineE = document.getElementById("statusline"),
      statusE = document.getElementById("status"),
      sendE = document.getElementById("send"),
      connectE = document.getElementById("connect"),
      callE = document.getElementById("call"),
      scMessageE = document.getElementById("scMessage");
      hangUp = document.getElementById("hangup");

  switch (str) {
    case 'Waiting':
      statusE.innerHTML =
        "Sweet! Now send your friend this link: " + getShareLink();
      break;
    case 'Connected':
      //statuslineE.style.display = "inline";
      //connectE.style.display = "none";
      //scMessageE.style.display = "inline-block";
      //hangUp.style.display = "inline-block";
      break;
    case 'Ready for call':
      //statusE.innerHTML = "You rock! Now press connect:";
      //Auto click connect if user pasted URL
      if (document.location.search) //Search isn't empty if has ?key= in it.
      {
        statusE.innerHTML = "Connecting to friend...";
	var connectBtn = document.getElementById('call');
        connectBtn.click()
      }//End auto click connect if user pased URL

      statusE.className = 'alert alert-info';
      callE.style.display = "inline";
      break;
    case 'On call':
      statusE.innerHTML = "On call";
      callE.style.display = "none";
      break;
    default:
  }

}

function log(msg) {
  console.log(msg);
}

function getShareLink() {
	var key = Seshi.getKey();
	return document.location.origin + '/?key=' + key;
}
