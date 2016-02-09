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
                        '#  Seshi.generateKey -- Returns a key (string) to be used when setting up a peer connection. This getts passed to the signalingServer.\n' +
                        '#  Seshi.store({\'dataSource\':\'fileSystem || seshiChunk\',\'data\':this.files}) -- Store data into Seshi\'s Database\n' +
                        '#  Seshi.storeProgress -- Arrary indexed by fileId shows store progress e.g. for (var key in Seshi.storeProgress){Seshi.storeProgress[key];}\n'+
                        '#  Seshi.updateLocalFilesList() -- Refreshes the local file list\n' +
                        '#  Seshi.localFileList() -- Returns list of local files in Array of JSON objects\n' +
                        '#  Seshi.play(fileId, element) -- Playback a file (fileId) in your browser, attaching it as the src of (element) video or audio tag\n' + 
                        '#  Seshi.sendLocalFileListToRemote -- Send local filelist to peer. Peer automatically sends theirs back populating Seshi.remoteFileList\n' +
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
    generateKey:function() {
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
                        return retVal;
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
                        var LocalFilesListWorker= new Worker('js/workers/getLocalFilesList.js');
                        LocalFilesListWorker.postMessage({'cmd':'listFilesMeHearty'});
                        //Act of response from worker (the list of files)
                        LocalFilesListWorker.onmessage = function(event) {
                        console.log("Updating list of local files. Type: Seshi.localFileList for updated list");
                        localStorage.setItem("localFilesList", JSON.stringify(event.data.fileList));
                        }
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
                        /* Sends given file (fieId) over Datachannel to connected peer */
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
boxId:'myBoxID'//Defaults to myBoxId
}//End Seshi :'(

Seshi.init();
