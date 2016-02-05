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
  key = document.getElementById("key").value;
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

// Yes, we do nothing if the remote side removes the stream.
function onRemoteStreamRemoved(e) {}

//When our browser detects that the other side has added the
//data channel, save it, set up handlers, and send welcome
// message
function onDataChannelAdded(e) {
    statusE = document.getElementById("status"),
    statusE.innerHTML = "We are connected!";
    console.log("We are connected!");
    sendMostRecentFile();
    dc = e.channel;
    setupDataHandlers();
    sendChat("Yolo! Seshi Init.");
    //Request file listing from remote peer
    msg = JSON.stringify({"cmd":"getRemoteFileList"});
    dc.send(msg);
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
                case 'getRemoteFileList': //Request from peer to see filelist
                    Seshi.sendLocalFileListToRemote(); //Local peer sends its local file lsit to remote 
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
            rtt.value = "";
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
			//Update upload progress box
			var uploadBar = document.getElementById('uploadProgress');
			var chunkProg = (chunk.chunkNumber + 1) / chunk.numberOfChunks * 100;
			uploadBar.style.width= chunkProg + "%";
			uploadBar.attributes[3] = chunkProg;
			//Set to zero on completion
			if ( chunkProg >= 100 ) 
			{
				uploadBar.style.width="0%";
				uploadBar.attributes[3] = 0;
			}

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

function sendFileToPeer(fileId) {
        //Presumes dc.send is already active
        console.log("Begin sending file: " + fileId + " to peer operations.");
        /* Query Indexed DB for all chunks pertaining to the requested fileId,
        send each chunk (potentially in any order), one chunk at a time,
        over the dc.send() datachannel as arraybuffers. */

        /* Steps: 
        *  > Query all chunks with file id x
        *  > For each chunk found, send over data channel until 'last chunk'* has been sent.
        *  > *Not all peers will have all chunks to the file, some may only have a subset.
        *  > Close the connection? no. 
        *       >Exchange useful data: 
        *               Share known signaling servers, peer exchange, file lists (names), boxIds
        */

        //Query for all chunks with given fileId.
        console.log("Querying and sending file to peer");
         db.chunks.where('fileId').equals(fileId).each(
                    function(boxChunks) {

                       
                        console.log(boxChunks);
                        dc.send(boxChunks);

                        })//End get fileList

}//end sendFileToPeer(fileId)
var sendStoreMsg = function(evt) {

    //Get data from file chosen
    var files = evt.target.files;
    var file = files[0];

    if(file) {
        //Get file metadata
        fileMeta = file;
        trace('File meta: ' + 'Name: ' + fileMeta.name + 
                ' Type: ' + fileMeta.type + ' Size: ' + fileMeta.size);
        trace('Uploading file ' + file);
 
        window.fileName = file.name;
        window.fileSize = file.size;
        window.fileType = file.type; 
        
        var reader = new FileReader();
            reader.onload = function(file) {
                if ( reader.readyState == FileReader.DONE) {
                    result = file.target.result;
                    //Generate uuid for file
                    var fileId = window.uuid();
                    //Get file size
                    console.log("File size is: " + result.byteLength);
                    var fileSize = result.byteLength;
                    //Begin chunking...
                    //Work out number of chunks needed
                    var maxChunkSize = 64512; //bytes
                    var maxChunkSize = 24512; //bytes
                    console.log("Chunk size is set to: " + maxChunkSize + " bytes.");
                    var numChunksNeeded = Math.ceil(fileSize/maxChunkSize);
                    console.log("We need " + numChunksNeeded + " chunks. (" + fileSize +"/" + maxChunkSize + ")");

                    var chunks = [];
                    var start = 0;
                    var end = maxChunkSize;
                    //Create blob from ArrayBuffer
                    var blob = new Blob([reader.result], {type: window.fileType});
                    reader.address = window.URL.createObjectURL(blob);

 
                        for(var i=0; i<= numChunksNeeded; i++)
                        {       //Send chunk over datachannel
                                var test = blob.slice(start,end);
                                //Incriment start by maxChunkSize
                                start = start + maxChunkSize;
                                //dc.send(test); //Disabled to allow chrome to function & until needed (see dataChannelBlobsHowto.txt)
                        }
                        
                    //Add chunks to indexedDB
                    var start = 0;
                    var end = maxChunkSize;
                    db.transaction("rw", db.chunks, function() {
                    //Begin chunking
                    for(var i=0; i<= numChunksNeeded; i++)
                    {
                        //chunks[i] = blob.slice(start, end);
                        var test = blob.slice(start,end);
                        
                        db.chunks
                            .add({
                                fileId: fileId,
                                boxId: window.boxId,
                                fileName: window.fileName,
                                fileType: window.fileType,
                                chunkNumber: i,
                                numberOfChunks: numChunksNeeded,
                                chunkSize: window.fileSize,
                                chunk: test 
                            });
                        console.log("uuid: " + fileId);
                        //Incriment start by maxChunkSize
                        start = start + maxChunkSize;
                        end = end + maxChunkSize;
                    }//End create chunks
                    }).then(function() {
                        //Transaction completed
                        //Reassemble from IndexedDB
                        console.log("looking for uuid: " + fileId);
                        db.chunks.where('fileId').equals(fileId).toArray(
                            function(found)
                            {
                            console.log("Found " + found.length + " chunks");
                            console.log(found[0].chunk);
                            var pic = new Blob(chunks, {type:"image/jpeg"});
                            url = window.URL.createObjectURL(pic);
                            
                            var allChunksArray = [];
                            //Just get blob cunks
                            for(var i=0;i<found.length; i++){
                                //console.log(found[i].chunk);
                                allChunksArray[i] = found[i].chunk
                            }
			    //Add this most recent file to 'lastItem' localstorage
			    window.localStorage.setItem('lastItem', fileId)
                            alert("Good job! File stored sucessfully.");
                            var pic = new Blob(allChunksArray, {type:found[0].fileType});
                            url = window.URL.createObjectURL(pic);
                            console.log("Data: " + url);
			    //Show box files 
			    var showFiles = document.getElementById('showFiles');
			    showFiles.click();
                            });
                    }).catch(function(error) {
                        //Transaction failed
                        console.log(error);
                    });


                }//End file reader.readstate == FileReader.DONE
            };
        //Send meta data
        fileMeta = JSON.stringify(fileMeta).replace(/\\r\\n/g,'\n');
        reader.readAsArrayBuffer(file);
        console.log('Sent data object');
    } else {
        trace('Failed to get file for upload.');
    }

}


/* Inspect store */
db.chunks.where('fileId').equals('b0d75183-cc10-4ddd-a326-81bea0adebcf').each(
    function(file){
        console.log(file.fileName);
        
        })

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
      syncMyData = document.getElementById('SyncMyData');

  switch (str) {
    case 'Waiting':
      statusE.innerHTML =
        "Sweet! Now send your friend this link: " + getShareLink();
      statusE.className = 'alert alert-success';
      connectE.style.display = "none";
      break;
    case 'Connected':
      statuslineE.style.display = "inline";
      connectE.style.display = "none";
      scMessageE.style.display = "inline-block";
      hangUp.style.display = "inline-block";
      syncMyData.style.display = "inline-block";
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
	var key = document.getElementById('key').value;
	return document.location.origin + '/?key=' + key;
}

function generateKey() {
    /* Cred: http://stackoverflow.com/a/1497512/885983 */
    var length = 8,
        charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        retVal = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}
