processRecieveBufferFLAG = false;

//Bye bye Safari
var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
if (isSafari) alert("Safari is not supported yet, please use Chrome or Firefox, or Opera");

Seshi = {
    welcome:(function(){   /*
                        #   Seshi Init
                        #   - Display welcome message -
                        */
                        var welcomeMsg = "🚀  Welcome to Seshi! 🚀\n\nLet's rock the boat...\n\n\nType Seshi.help() for help.. \n\n\n";
                        console.log(welcomeMsg);
                        return welcomeMsg;
                    })(),
    config:{
        "SeshiBotOn":false,
        "YoloInitMsg":false,
        "AUTO_RESUME_INCOMPLETE_TRANSFERS_ON":true
    },
    init:function(){
                        /* Initialise Seshi
                         *
                         * > Create all Seshi.events
                         * > Checks for existing Signaling Servers, adds Seshi.io as default
                         * > Updates local file list cache
                         */
                        //Register service worker
                        Seshi.serviceWorker();

                        // Restore Seshi.sendingFileProgress from localStorage (if present)
                        Seshi.restoreSendingFileProgress();
                        // Restore Seshi.storeProgress from localStorage (if present)
                        Seshi.restoreStoreProgress();

                        //Create & register Seshi spesific events
                        // - Custom Events triggered by Seshi useful to front-end UI development
                        // - The events are fired (dispatched) according to their individual case.

                        //Fired when peer begins waiting for connection from peer
                        onPeerConnectionWaiting = new Event('onPeerConnectionWaiting');
                        
                        //Fired when peer begins checking the peer connection
                        onPeerConnectionChecking = new Event('onPeerConnectionChecking');

                        //Fired when a datachannel is established between both peers
                        onPeerConnectionEstablished = new Event('onPeerConnectionEstablished');
                        onPeerConnectionEstablished.initEvent('onPeerConnectionEstablished', true, true);
                        
                        //Fired when resuming file transfer begins 
                        onPeerConnectionResumeTransfer = new Event('onPeerConnectionResumeTransfer');

                        //Fired when a datachannel is BROKEN between both peers
                        onPeerConnectionBroken = new Event('onPeerConnectionBroken');
                        onPeerConnectionBroken.initEvent('onPeerConnectionBroken', true, true);

                        //Fired when the datachannel recieves a file listing from their connected peer
                        gotRemoteFileList = new Event('gotRemoteFileList');
                        gotRemoteFileList.initEvent('gotRemoteFileList', true, true);

                        //Fired when a new chat message is recived
                        onNewChatMessage = new Event('onNewChatMessage');
                        onNewChatMessage.initEvent('onNewChatMessage', true, true);

                        //Fired when sending file progress update occurs (sending chunk-by-chunk over datachannel)
                        sendFileProgressUpdate = new Event('sendFileProgressUpdate');
                        sendFileProgressUpdate.initEvent('sendFileProgressUpdate', true, true);

                        //Fired when we have recived the display name of the connected device
                        onGotRemoteDisplayName = new Event('onGotRemoteDisplayName');
                        onGotRemoteDisplayName.initEvent('onGotRemoteDisplayName', true, true);

                        //Initalize storage worker
                        StorageWorker = new Worker("js/workers/storeFileDexieWorker.js");
                        //Recieve proress message(s)
                        StorageWorker.onmessage = function(event) {
                          //Desypher message type
                          switch (event.data.type) {
                            case 'storageProgressUpdate':
                              //recieve storage progress update and update Seshi.storeProgress array with fileId's progress
                              Seshi.storeProgressUpdate(event);
                              break;
                          }
                        }//End recieve storage worker onmessage event (parse msg type, dispatch to handlers accordingly)

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
   serviceWorker: function() {
                        /* serviceWorker() 
                         *  
                         *  Registers service worker for offline experience.
                         *
                         */
                         if ('serviceWorker' in navigator) {
                          navigator.serviceWorker.register('sw.js', { scope: '/'})
                             .then(function(reg) {
                                // registration worked
                                console.log('Registration of service worker succeeded. Scope is ' + reg.scope);
                             }).catch(function(error) {
                                console.log('Registration of service worker failed with ' + error);
                             });
                         }
   },
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
                        var array = new Uint32Array(1);
                        window.crypto.getRandomValues(array);
                        Seshi.key = array[0];
                        //Store key in localstorage (so can be used to prevent self connects)
                        localStorage.setItem('key', Seshi.getKey());
                        //Return key
                        return Seshi.getKey();
    },
    getKey: function() {
                        /* getKey()
                         * - Returns the current connection key
                         */
                        return Seshi.key;
    },
    getShareUrl: function() {
                        /* getShareURL
                         * - Returns the share url that the user needs to send to
                         *   their friend / other device
                         */
                        var shareUrl =  document.location.origin + '?key=' + Seshi.getKey() + '#fileBoxes';
                        return shareUrl;
    },
    setDisplayName: function(name) {
                        /* setDisplayName(name)
                         *
                         * - Set device / user display name
                         *   Used in chat window & to distinguish devices/users
                         */
                         //Set display name in local storage
                         localStorage.setItem("displayName", name);
                         trace("Set display name to: " + Seshi.getDisplayName());
    },
    getDisplayName: function() {
                        /* getDisplayName()
                         *
                         * - Returns the local peers display name
                         *   returns empty string if not set.
                         */
                         if(!localStorage.getItem("displayName")){
                            return ''; //Display name is not set
                         } else {
                            return localStorage.getItem("displayName")
                         }
    },
    sendLocalDisplayName:function() {
                        /* sendLocalDisplayName()
                         *
                         * - Send local display name to remote peer
                         *   over datachannel as SeshiBot message
                         */
                         //Build sendLocalDisplayName message
                         var displayNameMsg = {
                             'cmd':'remoteDisplayName',
                             'remoteDisplayName':Seshi.getDisplayName()
                         };

                         //Send over datachannel
                         displayNameMsg = JSON.stringify(displayNameMsg);
                         dc.send(displayNameMsg);
    },
    setRemoteDisplayName: function(msg) {
                        /* setRemoteDisplayName()
                         *
                         * - Receive remote peers display name from
                         *   over datachannel in form of SeshiBot message
                         */
                         //Store in localstorage ofr persistance
                         localStorage.setItem('remoteDisplayName', msg.remoteDisplayName);
                         //Fire event to let UI layer no we've got remotes' display name
                         dispatchEvent(onGotRemoteDisplayName);
    },
    getRemoteDisplayName: function() {
                          /* getRemoteDisplayName()
                           *
                           * - Returns the remote users display name (if set)
                           *   returns empty string if not set
                           */
                          if (!localStorage.getItem('remoteDisplayName')) {
                                return '';
                          } else {
                                return localStorage.getItem('remoteDisplayName');
                          }
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
    deleteFile:function(fileId){
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
        //Dispatch event telling any UI there's a (potentially) updated file listing from their peer
        dispatchEvent(gotRemoteFileList);
        console.log("Sucesfully recived peers list of files. Sending mine back..");

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
                        console.log("In store..");
                        StorageWorker.postMessage(dataSourceMsg); // Post data to worker for storage
    },
    storeProgress:[],
    storeProgressUpdate:function(event) {
                        var progressData = event.data;
                        //Update Seshi.storeProgess array with file storing progress updates, indexeded by fileId

                        if ( Seshi.storeProgress[progressData.fileId] === undefined )
                        {
                            currentChunk = 0;
                            chunksReceived = 0;
                        }else { //End set progress to zero initially
                            currentChunk = Seshi.storeProgress[progressData.fileId].currentChunk;
                            chunksReceived = Seshi.storeProgress[progressData.fileId].chunksReceived;
                        }//End else incriment currentChunk using current value

                        Seshi.storeProgress[progressData.fileId] = {
                            "fileId":progressData.fileId,
                            "fileName":progressData.fileName,
                            "storeType":progressData.storeType,
                            "currentChunk":currentChunk + 1,
                            "chunksReceived": chunksReceived + 1,
                            "totalNumChunks":progressData.totalNumChunks,
                            "status":progressData.status,
                            "complete":currentChunk >= progressData.totalNumChunks ? true:false,
                            "UIdone":false
                        }

                        var storeFilesProgressUpdate= new CustomEvent(
                            'storeFilesProgressUpdate',
                             {
                              'detail': {
                                  'type': progressData.storeType //Local file or Datachannel
                                    }
                             }); 
                        dispatchEvent(storeFilesProgressUpdate);//Dispacht/fire progress update event for local UI

                        //Tell peer if all chunks have been received
                        if ( chunksReceived == progressData.totalNumChunks )
                        {
                            //Build receive complete message
                            var receiveMsg = {
                             'cmd':'receiveComplete',
                             'fileId':progressData.fileId
                            };

                            //Send over datachannel
                            receiveMsg = JSON.stringify(receiveMsg);
                            
                            //Check Datachannel connection status
                            if (typeof dc != "undefined" || dc.readyState == "open") {
                                dc.send(receiveMsg); //Inform peer that we've stored the complete file.
                            }//End check Datachannel is actually open

                        }//End tell peer if all chunks have been received

                        //Delete completed storeProgess
                        if(Seshi.storeProgress[progressData.fileId].complete == true)
                        {
                            delete(Seshi.storeProgress[progressData.fileId]);
                        }

    },
    saveStoreProgress:function(){
                        /* saveStoreProgress()
                         *  TODO Consider refactoring as this is same as
                         *  saveSendingFileProgress() Saves the current
                         *  'in-memeory' Seshi.storeProgress back to localStorage
                         *
                         *  This is useful for store file (a Seshi 'pull')
                         *  recovery where the pull may have failed due to
                         *  break in connection etc. We can query this registry
                         *  to check which fileIds do not have the 'complete'
                         *  flag set
                         */
                        var storeProgressList = []; //To temporarily store in memory
                        //Get all in-memory Seshi.storeProgress items & add to
                        // storeProgressList for serialising.
                        for ( var fileId in Seshi.storeProgress ) {
                            storeProgressList.push(Seshi.storeProgress[fileId]);
                        }//End loop through each Seshi.storeProgress addding to storeProgressList

                        //Serialise storeProgressList
                        var serialisedStoreProgressList = JSON.stringify(storeProgressList);
                        //Store to localStorage
                        localStorage.setItem('storeProgress', serialisedStoreProgressList);
                        console.log('Saved file store progress to local storage');
    },
    restoreStoreProgress:function(){
                        /* restoreStoreProgress()
                         *     TODO Consider reactoring this is same as restoreSendingFileProgress()
                         *     Query local store for restoreStoreProgress and
                         *     (if present) parse the string into its
                         *     original form (an array) and set it to
                         *     Seshi.restoreStoreProgress indexed by fileId
                         */
                         try {
                            //Unpack restoreStoreProgress from localStorage
                            var unserialised = JSON.parse(localStorage.getItem('storeProgress'));
                            //Rebuild Seshi.restoreStoreProgress
                            for (var i=0;i<unserialised.length;i++) {
                                    Seshi.storeProgress[unserialised[i].fileId] = unserialised[i];
                            }//End restore each store progress file state to memory
                         }
                         catch (e) {
                            console.log("Error parsing StoreProgress from localStorage " + e);
                            console.log("Re-setting Seshi.storeProgress to empty array...");
                            Seshi.storeProgress = [];
                         }//end catch any errors parsing restoreStoreProgress from localStorage
    },
    sendLocalFileListToRemote:function(bool) {
        console.log("Should send my file list now over datachannel to peer..");
        //Send most up to date file listing or cached version?? hmm.
        //Prepare file list message to send to remote peer
        localFileList = JSON.stringify(Seshi.localFileList());
        msgSendLocalFileList = {"cmd":"recvRemoteFileList", "data":localFileList, "reply":bool};
        msgSendLocalFileList = JSON.stringify(msgSendLocalFileList);
        dc.send(msgSendLocalFileList);

        //Also send along local display name so user has some vauge idea who they might be connected to
        Seshi.sendLocalDisplayName();
    },
    generateObjectUrl:function(fileId) {
                        /* generatObjectUrl(fileId)
                         *
                         * - Generate a blob url for a given fileId
                         * Returns promise, which when resolved returns
                         * an object:
                         *  {
                         *      objectURL: 'blob url of object',
                         *      mimetype:  'mp3/example'
                         *  }
                        */
                        var promise = new Promise (function(resolve, reject) {
                            //Query IndexedDB to get the file
                            db.transaction('r', db.chunks, function() {
                                //Transaction scope
                                db.chunks.where("fileId").equals(fileId).sortBy("chunkNumber").then(function(chunks) {
                                            console.log("Found " + chunks.length + " chunks");
                                            var allChunksArray = [];
                                            //Just get blob cunks (without meta info)
                                            for(var i=0;i<chunks.length; i++){
                                                allChunksArray[i] = chunks[i].chunk
                                            }//End put all chunks into all chunks array
                                            var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                            var fileName = chunks[0].fileName;
                                            console.log(chunks[0].fileType);
                                            url = window.URL.createObjectURL(file);
                                            console.log("Data: " + url);
                                            resolve(
                                                {   objectURL:url, //A blob url
                                                    fileName: fileName,
                                                    mimeType: chunks[0].fileType //e.g. audio/ogg
                                                }); //Resolve promise
                                        })//Assemble all chunks into array
                                }).catch (function (err) {
                                    console.error(err);
                                })//End get file chunks from fileId and generate object url.
                        });//End promise
                        return promise;
    },
    play:function(fileId, playerId) {
                        /* Playback requested fileId to user
                         * - Updates video or audio `src` attribute of playerId and starts playback -
                         * TODO move Seshi.play to a streaming web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            //Transaction scope
                            db.chunks.where("fileId").equals(fileId.fileId).toArray(function(chunks) {
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
                            }).catch (function (err) {
                                console.error(err);
                            })});//End get file chunks from fileId and playback
    },
    pause:function() {
                        /* Seshi.pause()
                         * - Fire pause event informing SeshiSkin to pause
                         *   whatever it's playing.
                         */
                         dispatchEvent(onSeshiPauseReq);
    },
    isPlayable: function(mimeType, fileName) {

                               if(mimeType.includes('audio') || mimeType.includes('video'))
                                {
                                    return true;
                                }

                               switch(mimeType) {
                                    case 'audio/mp3':
                                    case 'audio/ogg':
                                    case 'audio/wave':
                                    case 'audio/webm':
                                    case 'audio/wav':
                                    case 'audio/x-wav':
                                    case 'audio/x-pn-wav':
                                    case 'audio/x-aac':
                                    case 'audio/midi':
                                    case 'audio/audible':
                                    case 'video/mp4':
                                    case 'video/ogg':
                                    case 'video/3gpp':
                                    case 'video/quicktime':
                                    case 'video/webm':
                                    case 'video/mpeg':
                                    case 'video/x-flv':
                                    case 'video/x-msvideo':
                                    case 'application/ogg':
                                         return true;
                                }//End check mimetype

                               // Check type using filename (last resort)
                               if(fileName) {
                                    fileName = fileName.toLowerCase();
                                    /* Mp3 */
                                    if (fileName.indexOf('.mp3') > -1) {
                                        return true;
                                    }
                                    /* Mp4 */
                                    if (fileName.indexOf('.mp4') > -1) {
                                        return true;
                                    }
                                    /* webm */
                                    if (fileName.indexOf('.webm') > -1) {
                                        return true;
                                    }

                               }//End check type using filename (last resort)

                               return false;
    },
    download:function(fileId) {
                        /* Download
                        * - Download a given fileId from Seshi's database to the system's filesystem boo.
                        * TODO move Seshi.download job to a web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            db.chunks.where("fileId").equals(fileId).sortBy("chunkNumber").then(function(chunks) {
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
    sendFileToPeer:function(sendDataRequest) {
                        /* Sends file over Datachannel to connected peer
                         * Send over data channel requested (ALL or PART) of file
                         * The following comments require multipeer (TODO)
                         *  > *Not all peers will have all chunks to the file, some may only have a subset.
                         *  > Close the connection? no.
                         *  > Exchange useful data:
                         *      Share known signaling servers, peer exchange, file lists (names), boxIds
                        */
                        //Work our request type to determine chunk offset (if RANGE request)
                        var fileId = undefined;
                        var whereClause = 'fileId';
                        var equalsClause = undefined;
                        var requestedOffset = 0;
                        var partialSendBool = true;
                        switch(sendDataRequest.requestType)
                        {
                            case 'ALL':
                                console.log("Processing request for fileId: " + sendDataRequest.fileId);
                                equalsClause = sendDataRequest.fileId;
                                partialSendBool = false
                                break;
                            case 'CHUNK':
                                console.log("Request for single chunk..");
                                whereClause = "[fileId+chunkNumber]"; //Search by compound index for single chunk
                                equalsClause = [ sendDataRequest.fileId, sendDataRequest.chunkNumber];
                                limitCount = 1;
                                break;
                            case 'CHUNK-RANGE':
                                console.log("Processing request for chunk range for fileId: " + sendDataRequest.fileId);
                                equalsClause = sendDataRequest.fileId;
                                requestedOffset = sendDataRequest.rangeStart;
                                limitCount = (sendDataRequest.rangeEnd - requestedOffset) + 1;
                                break;
                            case 'RANGE':
                                console.log("Request for RANGE of chunks..");
                                break;
                            default:
                                try {
                                    //Parse sendDataRequest to just get pain old fileId
                                    console.log("Processing plain old fileId request");
                                    parsed = JSON.parse(sendDataRequest);
                                    equalsClause = parsed[0].fileId;
                                    partialSendBool = false;
                                } catch (e) {
                                    equalsClause = sendDataRequest;
                                    console.log("Default fallback to Processing request for entire fileId: " + fileId);
                                    partialSendBool = false;
                                }
                        }//End work our request type (ALL/CHUNK/RANGE) and act accordinly

                        //Set flag for outbox
                        Seshi.flagProcessOutboxStarted = true;
                        //Check Datachannel connection status
                        if (typeof dc == "undefined" || dc.readyState != "open") {
                            console.error("Seshi.sendFileToPeer(fileId) Tried to send file to peer but Datachannel is not open");
                            return false;
                        }//End check Datachannel is actually open

                        if(partialSendBool)
                        {
                            db.transaction('r', db.chunks, function() {
                                db.chunks.where(whereClause).equals(equalsClause).offset(requestedOffset).limit(limitCount).sortBy("chunkNumber").
                                then(function(chunks)
                                {
                                    chunks.forEach(function(chunk)
                                    {
                                    //Transaction scope
                                    //Sending file meta...
                                    var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "boxId":chunk.boxId, "checksum":chunk.checksum,"chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                                    var lengthOfMeta = JSON.stringify(meta).length;
                                    lengthOfMeta = zeroFill(lengthOfMeta, 64);
                                    var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified
                                    var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                                    var sendChunk = new Blob([header, chunk.chunk]);
                                    //Add chunk to outBox for sending

                                    //Convert chunk to ArrayBuffer before adding to buffer
                                    var frRangeToArrayBuffer = new FileReader;
                                    frRangeToArrayBuffer.onload = function(chunk) { 
                                        Seshi.outBox.push(chunk.target.result);
                                        Seshi.processOutbox();
                                        //Close outbox flag so we don't repeatedly open a new filereader
                                        Seshi.flagProcessOutboxStarted=false;
                                    }//End read chunk as ArrayBuffer and push to Seshi.outBox
                                    frRangeToArrayBuffer.readAsArrayBuffer(sendChunk);

                                    });//End add each chunk from range to Seshi.outBox
                                 })})

                        } else { //Send all chunks fallback
                            db.transaction('r', db.chunks, function() {
                                db.chunks.where(whereClause).equals(equalsClause).each(function(chunk) {
                                //Transaction scope
                                //Sending file meta...
                                var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "boxId":chunk.boxId, "checksum":chunk.checksum, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                                var lengthOfMeta = JSON.stringify(meta).length;
                                lengthOfMeta = zeroFill(lengthOfMeta, 64);
                                var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified
                                var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                                var sendChunk = new Blob([header, chunk.chunk]);
                                //Add chunk to outBox for sending
                                //Convert chunk to ArrayBuffer before adding to buffer
                                var frToArrayBuffer = new FileReader;
                                frToArrayBuffer.onload = function(chunk) {  
                                                    Seshi.outBox.push(chunk.target.result);
                                                    Seshi.processOutbox();
                                                    //Close outbox flag so we don't repeatedly open a new filereader
                                                    Seshi.flagProcessOutboxStarted=false;
                                }//End read chunk as ArrayBuffer and push to Seshi.outBox
                                frToArrayBuffer.readAsArrayBuffer(sendChunk);


                                }).then(function(){
                                Seshi.flagProcessOutboxStarted = true;
                                Seshi.processOutbox();
                                })});
                        }//End Send all fallback
    },
    outBox:[],
    flagProcessOutboxStarted:true,
    processOutbox:function() {
                    /* processOutbox()
                     *
                     * - Reads outbox & sends each message to peer untill outBox is empty.
                     */
                    if ( Seshi.flagProcessOutboxStarted == true && Seshi.outBox.length > 0)
                    {
                        Seshi.sendAllData(); //Send arrayBuffer chunks out over datachannel with buffering
                    }//End only open reader again if flagProcessOutboxStarted is set to true.
    },
    updateSendingProgress: function(ack) {
                    /* This is called by receivedChunkACK comman from over the datachannel.
                     * This occurs when the connected peer has sucessfully received, and stored
                     * A chunk which we sent to them. the 'receivedChunkACK' is their confirmation
                     * which we then use to update the sender on the progress of their push.
                     * (A push is a file 'upload' to a connected peer).
                     * */
                    //For file progress, just count number of ACKS received, not the actual
                    // chunk number in the ACK message, because chunks mayt arrive out of order TODO <<Question this.
                    // therefore ack.chunkNumber is not a reliable indicator of chunk recieved progress

                    if ( Seshi.sendingFileProgress[ack.fileId] === undefined )
                    {
                        recvChunkCount = 0;
                    }else { //End set progress to zero initially
                        recvChunkCount = Seshi.sendingFileProgress[ack.fileId].recvChunkCount;
                    }//End else incriment currentChunk using current value

                    Seshi.sendingFileProgress[ack.fileId] = {
                        "percentComplete"   : (ack.chunkNumber + 1) / ack.numberOfChunks * 100,
                        "fileName"          : ack.fileName,
                        "fileId"            : ack.fileId,
                        "fileType"          : ack.fileType,
                        "chunkNumber"       : ack.chunkNumber,
                        "numberOfChunks"    : ack.numberOfChunks,
                        "recvChunkCount"    : recvChunkCount + 1,
                        "complete"          : recvChunkCount >= ack.numberOfChunks ? true:false,
                        "UIdone"            : false
                    }//End update Seshi.sendingFileProgress[]

                    //Fire sendFileProgressUpdate event so sender knows to update their UI with sending progress bar
                    dispatchEvent(sendFileProgressUpdate);
                    //Delete completed storeProgess
                    if(Seshi.sendingFileProgress[ack.fileId].complete == true)
                    {
                        delete(Seshi.sendingFileProgress[ack.fileId]);
                    }
                    //Save sendingFileProgres to localStorage
                    Seshi.saveSendingFileProgress();
    },
    bufferFullThreshold:4096,
    listener: function() {
                dc.removeEventListener('bufferedamountlow', Seshi.listener);
                Seshi.sendAllData();
    },
    sendAllData: function() {
        while (Seshi.outBox.length > 0) {
                if(dc.bufferedAmount > Seshi.bufferFullThreshold) {
                    //Use polling (forced)
                    //setTimeout(Seshi.sendAllData, 106500);
                    dc.addEventListener('bufferedamountlow', Seshi.listener);
                    return; //Exit sendAllData  until ready because buffer is full
                }//End wait for buffer to clear (dc.bufferedAmount > bufferFullThreshold)
                dc.send(Seshi.outBox.shift());
        }//End while buffer is not empty
	if ( Seshi.buffer.length > 0) 
	{
            Seshi.sendAllData();
	}
    },
    buffer:[],
    recvBuffer:[],
    restoreSendingFileProgress:function(){
                            /* restoreSendingFileProgress()
                             *  Query localStorage for sendingFileProgress and
                             *  (if present) parse the string into its
                             *  original form (an array) and set it to
                             *  Seshi.sendingFileProgress indexed by fileId
                             *
                             *  This can be used to recover from failed uploads
                             *  as it maintains a registy of fileIds and their
                             *  percent completions.
                            */
                            try {
                                //Unpack sendingFileProgress from localStorage
                                var unserialised = JSON.parse(localStorage.getItem('sendingFileProgress'));
                                //Rebuild Seshi.sendingFileProgress
                                for (var i=0;i<unserialised.length;i++) {
                                    Seshi.sendingFileProgress[unserialised[i].fileId] = unserialised[i];
                                }
                            }
                            catch (e) {
                                console.log("Error parsing sendingFileProgress from localStorage " + e);
                                console.log('Re-setting Seshi.sendingFileProgress to empty array...');
                                Seshi.sendingFileProgress = [];
                            }
    },
    saveSendingFileProgress:function() {
                            /* saveSendingFileProgress()
                             *   Saves the sendingFileProgress back to localStorage
                             *   from in-memory Seshi.sendingFileProgress
                             *
                             *   This is useful for sendingFile recovery, to
                             *   know which files may have failed to completely
                             *   be sent to a peer we can check this registry.
                             */
                            var sendingFileProgressList = []; //To temporarily store in memory

                            //Get all in-memory sendingFileProgress & add to sendingFileProgressList for serialising.
                            for ( var fileId in Seshi.sendingFileProgress) {
                                sendingFileProgressList.push(Seshi.sendingFileProgress[fileId]);
                            }

                            //Serialise sendingFileProgressList
                            var serialisedSendingFileProgressList = JSON.stringify(sendingFileProgressList);

                            //Store to localStorage
                            localStorage.setItem('sendingFileProgress', serialisedSendingFileProgressList);
                            console.log('Saved sending progress to local storage');
    },
    sendingFileProgress:[],
    checkForIncompleteTransfers:function() {
                            /* checkForIncompleteTransfers()
                             *
                             *   Checks for incomplete push & pull trnasfers
                             *   If found, fire {} events to UI to request
                             *   resume of these files. OR auto recommence
                             *   if AUTO_RESUME_INCOMPLETE_TRANSFERS flag is set.
                             */

                            if (Seshi.config.AUTO_RESUME_INCOMPLETE_TRANSFERS_ON)
                            {
                                //Query Seshi.storeProgress for incomplete transfers
                                var incompletePulls = Seshi.getIncompletePulls();
                                if (!incompletePulls.length)
                                {
                                    console.log("Nothing to send, there are no incomplete pulls.");
                                    return;
                                }//End exit if there are no incomplete pulls

                                //Tell UI we're attempting to resume file transfers
                                dispatchEvent(onPeerConnectionResumeTransfer);

                                var filesRequested = [];
                                //request each incomplete file from peer using RANGE request
                                incompletePulls.forEach(
                                        function(file) {
                                           console.log("Should ask for: " + file);
                                           //Get chunks needed, then send chunk pull request
                                           Seshi.buildRangeRequests(file.fileId)
                                           .then(function() {
                                               Seshi.ranges.forEach(function(rangeRequest)
                                               {
                                                var msg = {"cmd":"requestFilesById", "data":rangeRequest};
                                                msg = JSON.stringify(msg);
                                                dc.send(msg); //TODO this presumes a peer connection..it should not
                                               });// End build filesRequested array containing missing chunks to request
                                           });//End got array of which chunk numbers are missing
                                }); //End request each incomplete file from peer

                            }//End if AUTO_RESUME_INCOMPLETE_TRANSFERS_ON resume transfers
    },
    getIncompletePulls:function(){
                            /* Returns an array of incomplete pulls with their
                             * ranges needed. (a file may have 'holes' in it)
                             * This method works out the range requests needed
                             * to reform the file.
                             *
                             *  Each element contains:
                             *  > fileId
                             *  > currentChunk
                             *  > totalNumChunks
                             *  > fileName
                            */
                            var fileList = [];
                            for (var fileId in Seshi.storeProgress) {
                                if( Seshi.storeProgress[fileId].complete == false)
                                {
                                    var file = Seshi.storeProgress[fileId];
                                    console.log(fileId);
                                    file.fileId = fileId;
                                    fileList.push(file);
                                }
                            }

                            if (fileList.length > 0)
                            {
                                return fileList;
                            }
                            console.log('There were no incomplete pulls found.');
                            return false;
    },
    calculateMissingChunks:function(fileId){
                            /* calculateMissingChunks(fildId)
                             *
                             *  Returns array of chunk numbers missing
                             *  (if any) for a given fileId).
                             *
                             *  TODO return RANGES of contigious missing
                             *  chunks if possible.
                             */
                            var promise = new Promise(function(resolve, reject) {
                                //Get total number of chunks for fileId (how many there should be, not how many we have)
                                db.chunks.where("fileId").equals(fileId)
                                .first(function(first){
                                    expectedNumberOfChunks = first.numberOfChunks;
                                    var haveChunks = [];
                                    //Iterate over every chunk to identify which chunks are present.
                                    //TODO this is stupid. Just query indexed DB and generate an array of existing keys,
                                    // no to to itteratate over each chunk for fileId.numberOfChunks times!
                                    db.chunks.where("fileId").equals(fileId)
                                        .each(function(chunk){
                                            haveChunks.push(chunk.chunkNumber);
                                    }).then(function(){
                                        //Sort the haveChunks array ascending
                                        haveChunks = haveChunks.sort(function(a,b){return a - b;});
                                        missingChunks = [];
                                        //Loop though chunks we do have to identify missing chunk numbers
                                        for ( var i=0; i< expectedNumberOfChunks;i++ )
                                        {
                                           if (haveChunks.indexOf(i) == -1)
                                           {
                                                missingChunks.push(i);
                                           }
                                        }
                                                resolve(missingChunks); //Resolve promise (return array of missing chunks)
                                    });

                                }) //End get number of chunks for the complete file, and work out missing chunks.
                                .catch(function(err) {
                                    console.log("Error:");
                                    console.error(err);
                                });
                            });//End promise (return array of missing chunks for given fileId
                            return promise;
    },
    buildRangeRequests: function(fileId) {
                            /*
                             *
                             */
                            return new Promise(function(resolve, reject)
                            {
                                Seshi.calculateMissingChunks(fileId)
                                .then(function(list) {
                                    //Sort list
                                    list = list.sort(function(a, b) {
                                          return a - b
                                    });

                                    /* Create ranges
                                     *
                                     */
                                    Seshi.ranges = [];
                                    buildRanges(list).then(function(){resolve();});
                                    function buildRanges(list) {
                                        var promises = [];
                                        //Iterate over
                                        for (var i=0;i<list.length; i++)
                                        {
                                            promises.push(checkForSpace(list[i]));
                                        }//End iterate over list.
                                        return Promise.all(promises);
                                    }//End buildRanges

                                    function checkForSpace(chunkNumber) {
                                        return new Promise(function(resolve, reject)
                                        {
                                            //Check last element of Seshi.ranges array to see if there's a gap.
                                            //If chunkNumber is equal to range.end + 1, update the rangeEnd
                                            //for this element.
                                        if (Seshi.ranges[Seshi.ranges.length - 1] !== undefined)
                                        {
                                            if ( Seshi.ranges[Seshi.ranges.length - 1].rangeEnd + 1 == chunkNumber )
                                            {
                                                 Seshi.ranges[Seshi.ranges.length - 1].rangeEnd = chunkNumber;
                                                 resolve(); //Resolve (updated existing range)
                                                 return true;
                                            }
                                        }//End check Seshi.ranges[Seshi.ranges.length - 1] is defined (won't be first iteration)

                                            //Otherwise, create new range element in ranges array.
                                                Seshi.ranges.push({requestType:'CHUNK-RANGE',rangeStart:chunkNumber, rangeEnd:chunkNumber, fileId:fileId});
                                                resolve();//Resolve (added new range)
                                        });//End promise checkfor space
                                    }//End checkForSpace
                                });//End get all missing chunks for given fileId, and return Range requests array
                            });//End buildRangeRequests promise
    },
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
    requestFilesFromPeer:function(filesRequested) {
                            /* requestFilesFromPeer(filesRequested)
                             *
                             * - Request files from peer (we can see them in
                             *   Seshi.remoteFileList, now we want to request to
                             *   pull them from our peer to our own device!
                             *
                             * Requires datachannel to be open!
                             *
                             * To check dataChannel is open use:
                             * Seshi.connectionStatus.dataChannelState() == 'open'
                             *
                             * Arguments:
                             * `filesRequested` should be an array of
                             *   objects in the following format:
                             * [
                             *  {
                             *      fileId: 'xyz123',
                             *      requestType:'ALL || 'CHUNK' || 'RANGE'
                             *  },
                             *  {
                             *      fileId: 'anotherFileIdExample',
                             *      requestType: 'ALL'
                             *  }
                             * ]
                             *
                             * You can use this to request an entire file from a peer
                             * or TODO a single chunk, or range of chunks.
                             *
                             */

                            //Stringify requested files object
                            var filesRequested = JSON.stringify(filesRequested);
                            //Send command over DataChannel to peer
                            msg = {"cmd":"requestFilesById", "data":filesRequested};
                                   msg = JSON.stringify(msg);
                                           dc.send(msg);
                            //Happy dance we've done a full cirlce & re-implimented a crude FTP in Javascript
                            // go figure!
    },
    sendRequestedFilesToPeer:function(filesRequested){
                            /* sendRequestedFilesToPeer(files)
                             * - Respond to peer request to PULL files from their connected peer
                             *   `filesRequested` is an array of objects containing fileIds and the
                             *   parts of the file that the user is requesting (request type)
                             *
                             *   The request type defaults to send 'ALL' chunks
                             *
                             * TODO requestType can be set to only request certain chunks,
                             * a single chunk, or a range of chunks. This is useful for
                             * a broken download for example, or syncing accross many peers.
                             *
                             * The format of the `filesRequested` argument should be:
                             *
                             * [
                             *  {
                             *      fileId: 'xyz123',
                             *      requestType:'ALL || 'CHUNK' || 'RANGE'
                             *  },
                             *  {
                             *      fileId: 'anotherFileIdExample',
                             *      requestType: 'ALL'
                             *  }
                             * ]
                             */

                            console.log(filesRequested);
                            //Work out what they want
                            //var filesRequested = JSON.parse(filesRequested.data);

                            //Loop though each request sending the file to the peer as requested
                            try { //Interprit filesRequested.data as stringified object
                                var requestedFileList = JSON.parse(filesRequested.data);
                            } catch (e) {
                                console.log("Could not parse as JSON stringified object. Trying as object");
                            }
                            try { //Interprit as already an object
                                var requestedFileList = filesRequested.data;
                            } catch (e) {
                                console.log("Could not interprit filesRequested, exiting.");
                                return;
                            }

                            Seshi.sendFileToPeer(requestedFileList);
    },
    receiveCompleteHandler:function(msg){
            /* Called in response to receiveComplete command
            * from over datachannel. 
            * 
            *   Used to remove completed upload/push progress
            *   data from Seshi.sendingFileProgress array
           */
                    
            //delete completed file push/upload from Seshi.sendingFileProgress
            delete(Seshi.sendingFileProgress[msg.fileId]);
            
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
notify: function(message) {

            if (Notification.permission !== 'denied')
            {
                Notification.requestPermission(function (permission)
                    {
                        // If the user accepts, let's create a notification
                        if (permission === "granted")
                        {
                            var options = {
                                body:message.chat,
                                icon: 'img/seshilongbetablue.png'
                            }

                            //Generate title
                            var displayName = Seshi.getDisplayName();
                            if (displayName.length > 0 )
                            {
                                var title = Seshi.getRemoteDisplayName() + ' says:';
                            } else {
                                var title = 'New message: ';
                            }//End generate title

                            //Only show notification if page is hidden (see https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
                            if ( document.hidden )
                            {
                                var notification = new Notification(title, options);
                            }//End only show notification if page is hidden
                        }
                    });
            }//End check we have notification permissions

}
,trace: function(text) {
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
//

if(getQueryVariable("key")) {
    Seshi.key = getQueryVariable("key");
    //Prevent user connecting to themselves
    if (localStorage.getItem('key') != Seshi.key)
    {
        connect();
    }//End prevent user connecting to themselves
}//End auto-connect is key is in URI


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
  window.pc.onsignalingstatechange = onSignalingStateChanged;
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
// TODO change to switch statement
    if (pc.iceConnectionState == 'checking') {   
       dispatchEvent(onPeerConnectionChecking);
    }

    if ( pc.iceConnectionState == 'completed' || pc.iceConnectionState == 'connected') {
        //dispatch event onPeerConnectionEstablished since we now have a peer connection (TODO check datachannel state too!)
        dispatchEvent(onPeerConnectionEstablished);
        //Remove key guard from localstorage which prevents users from connecting to themselves
        localStorage.removeItem('key');
        //Check for incomplete transfers (auto resumes them if AUTO_RESUME_INCOMPLETE_TRANSFERS_ON)
        Seshi.checkForIncompleteTransfers();
    }//End if iceConnectionState == Completed

    if (pc.iceConnectionState == 'disconnected' || pc.iceConnectionState ==  'failed'){
        dispatchEvent(onPeerConnectionBroken);
    }//End if iceConnection state is disconnected or failed, dispatch onPeerConnectionEstablished event
}//End onIceconnectionStateChanged

// Yes, we do nothing if the remote side removes the stream.
function onRemoteStreamRemoved(e) {}

//When our browser detects that the other side has added the
//data channel, save it, set up handlers, and send welcome
// message
function onDataChannelAdded(e) {
    dc = e.channel;
    console.log("We are connected!");
    //sendMostRecentFile();
    setupDataHandlers();
    if ( Seshi.config.YoloInitMsg )
    {
        sendChat("Yolo! Seshi Init.");
    }//Show Seshi init message

    e.channel.onopen = function(){
        //Request file listing from remote peer
        Seshi.sendLocalFileListToRemote();
    }//Once datachannel is open, send over local file listing
}

//When our browser detects a Signaling State Change,
//check to see if it is 'stable'
//if so, execute call() to create a datachannel
function onSignalingStateChanged() {

    console.log("Signaling State Changed to: " + pc.signalingState);

}//End onSignalingStateChanged()


//Set up the datachanner message handler
function setupDataHandlers() {
    data.send = function(msg) {
        msg = JSON.stringify(msg);
        console.log("Sending: " + msg + " over data channel");
        dc.send(msg);
    }
    dc.onmessage = function(event) {

        console.log("We got: " + event.data);

        //Check if message is an array buffer (data)
        if(event.data instanceof ArrayBuffer || event.data.size){ //event.data.size is for Firefox(automatically transforms data to Blob type
            console.log('Recieved ArrayBuffer message');
            //Catch ArrayBuffer sent through the datachannel & add it to recvBuffer for later processing
            Seshi.recvBuffer.push(new Blob([event.data]));

            if ( processRecieveBufferFLAG == false )
            {
                processRecieveBuffer();
            }//Only run processRecieveBuffer() if not already running

        } else { //If not an ArrayBuffer , treat as control packet.
            if(JSON.parse(event.data))
            {
                fileMeta = JSON.parse(event.data);
            }
        }//End determin if data message or control message.

        //Don't JSON.parse is data is already an object ;)
        if ( typeof event.data != "object" ) {
                var msg = JSON.parse(event.data);
        } else {
                var msg = event.data;
        }//End don't parse data message recived if already an object!



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
                case 'receivedChunkACK': //Got a received & stored Chunk ACK from peer.
                    trace("Peer told me that they've sucessfully received & stored a chunk I sent them. Yay.");
                    Seshi.updateSendingProgress(msg.data);
                    break;
                case 'receiveComplete': //Peer has told us they received all chunks of a file
                    Seshi.receiveCompleteHandler(msg);
                    break;
                case 'requestFilesById': //Receiving request from peer to pull files from their peer.
                    Seshi.sendRequestedFilesToPeer(msg);
                    break;
                case 'remoteDisplayName': //Receiving remote's display name
                    Seshi.setRemoteDisplayName(msg);
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

            var timeStamp = new Date();
            timeStamp = timeStamp.toString();
            timeStamp = timeStamp.substring(0,21);
            //Filter chat message
            chatData = filterXSS(msg.chat, {
                whiteList:          [],        // empty, means filter out all tags
                stripIgnoreTag:     true,      // filter out all HTML not in the whilelist
                stripIgnoreTagBody: ['script'] // the script tag is a special case, we need to filter out its content
                });

            // TODO Move below to Seshi Skin


            //END TODO Move above to Seshi Skin.

            //Dispatch event to UI informing it about the new chat message
            var onNewChatMessage = new CustomEvent(
                                'onNewChatMessage',
                                    {
                                        'detail': {
                                                    'message': chatData,
                                                    'timestamp': timeStamp,
                                                    'remoteDisplayName': msg.remoteDisplayName
                                                  }
                                    });
            dispatchEvent(onNewChatMessage);
            //Notify user of new message
            Seshi.notify(msg);

            } else if (msg.storeData) {
                console.log("Received data store message.");
            }
           };
    }

function sendChat(msg) {
    var cb = document.getElementById("chatbox"),
    c = document.getElementById("message-to-send");

    //Display message locally, send it, and force chat window to
    // last line
    msg = msg || c.value;
    console.log("calling sendChat(" + msg + ")");
    //TODO Move (below) to SeshiSkinExample to keep seperate from API:
    var timeStamp = new Date();
    timeStamp = timeStamp.toString();
    timeStamp = timeStamp.substring(0,21);
    //Filter chat message
    chatData = filterXSS(msg, {
        whiteList:          [],        // empty, means filter out all tags
        stripIgnoreTag:     true,      // filter out all HTML not in the whilelist
        stripIgnoreTagBody: ['script'] // the script tag is a special case, we need to filter out its content
        });
    var localChatMsg =
            '<li>' +
            '<div class="message-data align-left">' +
            '    <span class="message-data-name">' +
            '        <i class="fa fa-circle online"></i> ' +
                        Seshi.getDisplayName() +
            '    </span>' +
            '<span class="message-data-time">' + timeStamp + '</span>' +
            '</div>' +
            '    <div class="message my-message">' +
                                chatData +
            '    </div>' +
            '</li>';
    cb.insertAdjacentHTML('beforeend', localChatMsg);

    data.send({'chat':msg, 'remoteDisplayName':Seshi.getDisplayName()});
    c.value = '';
    cb.scrollTop = cb.scrollHeight;
}//End sendChat()


function zeroFill( number, width )
{
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
}//End zeroFill


function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
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
      console.log("Sweet! Now send your friend this link: " + getShareLink() + " status: waiting");
      dispatchEvent(onPeerConnectionWaiting);
      break;
    case 'Connected':
      break;
    case 'Ready for call':
      //statusE.innerHTML = "You rock! Now press connect:";
      //Auto click connect if user pasted URL
      if (document.location.search) //Search isn't empty if has ?key= in it.
      {
        console.log("Connecting to friend...");
      }//End auto click connect if user pased URL

      break;
    case 'On call':
      console.log("On call");
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

function getQueryVariable(variable)
{
       //Credit: https://css-tricks.com/snippets/javascript/get-url-variables/
       var query = window.location.search.substring(1);
       var vars = query.split("&");
       for (var i=0;i<vars.length;i++) {
               var pair = vars[i].split("=");
               if(pair[0] == variable){return pair[1];}
       }
       return(false);
}

function getMetaLength(blob) {
  return new Promise((resolve, reject) => {
      //Get length of file meta (size specified is always a zerofilled 64byte long string at the begining of the blob
      var metaLength = blob.slice(0,81);
      //Read metaLength to get size in bytes of chunk fileMeta
      var reader = new FileReader();
      reader.onload = function(event) {
        if (reader.readyState == FileReader.DONE ) 
        {
          var metaLength = event.target.result;
          var metaLength = JSON.parse(metaLength).metaLength;
          var metaLength = parseInt(metaLength);
          console.log("Meta length is:" + metaLength);
          resolve({"metaLength":metaLength, "blob":blob});
        }
      }
    reader.readAsText(metaLength);
  });
};

function parseMetaSegment(seshiMeta) {
  return new Promise((resolve, reject) => {
  //Split file meta from begining of chunk based on meta length)
  var chunkFileMeta = seshiMeta.blob.slice(81, seshiMeta.metaLength + 81); //First get file type, chunk number etc
  var reader = new FileReader();
  reader.onload = function(event) {
  if ( reader.readyState == FileReader.DONE ) 
  {
    result = event.target.result;
    chunkMeta = JSON.parse(result);
    //Start send data payload
    var headerOffset = 81 + seshiMeta.metaLength;
    var chunk = seshiMeta.blob.slice(headerOffset); //Get chunk payload
    var storeReqObj = {
        "dataSource"    : "seshiChunk",
        "boxId"         : Seshi.getBoxId(),
        "checksum"      : chunkMeta.checksum,
        "chunk"         : chunk,
        "chunkNumber"   : chunkMeta.chunkNumber,
        "chunkSize"     : chunkMeta.chunkSize,
        "fileId"        : chunkMeta.fileId,
        "fileName"      : chunkMeta.fileName,
        "fileType"      : chunkMeta.fileType,
        "numberOfChunks": chunkMeta.numberOfChunks
    };
    resolve(storeReqObj);
  }
  };
  reader.readAsText(chunkFileMeta);
});}


function storeChunk(storeReqObj) {
  return new Promise((resolve, reject) => {
    StorageWorker.postMessage(storeReqObj);
    StorageWorker.addEventListener("message", function(e) {
				if (e.data.type == "storageProgressUpdate" && e.data.storeType == "remote") {
        	resolve(storeReqObj);
				}
    });
  });
}

function sendReceivedChunkACK(storeReqObj) {
	return new Promise((resolve, reject) => {
		//Send back ACK to remote peer with progess update
		var peerReceivedChunkACK = {
      'cmd':'receivedChunkACK',
			'data':{
        'boxId'         : Seshi.getBoxId(),
        'fileId'        : storeReqObj.fileId,
        'fileName'      : storeReqObj.fileName,
        'fileType'      : storeReqObj.fileType,
        'numberOfChunks': storeReqObj.numberOfChunks,
        'chunkNumber'   : storeReqObj.chunkNumber,
        'chunkSize'     : storeReqObj.chunkSize
			}
		};
    //Send chunk received ACK over datachannel to peer
    peerReceivedChunkACK = JSON.stringify(peerReceivedChunkACK);
    dc.send(peerReceivedChunkACK);
    resolve();
  });
}

function processRecieveBuffer() {

    if ( Seshi.recvBuffer.length == 0 )
    {
        processRecieveBufferFLAG = false;
        return; //Because we're done.
    }
    processRecieveBufferFLAG = true;
    /* Process each chunk in Seshi.ReciveBuffer */
    while (Seshi.recvBuffer.length > 0 ) {
      var blob = Seshi.recvBuffer.pop();
      getMetaLength(blob)
      .then(seshiMeta => parseMetaSegment(seshiMeta))
      .then(seshiChunk => storeChunk(seshiChunk))
      .then(storeReqObj => sendReceivedChunkACK(storeReqObj));
    }

}//End processRecieveBuffer.

window.uuid = function()
{   /* Credit http://stackoverflow.com/a/2117523 */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
    });
}

window.setInterval(function(){processRecieveBuffer();}, 2000); //remove this in the morning...
