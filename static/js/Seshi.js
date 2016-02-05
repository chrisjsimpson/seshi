Seshi = {
    init:(function(){   /* 
                        #   Seshi Init
                        #   - Display welcome message - 
                        */
                        console.log("🚀  Welcome to Seshi! 🚀\n\nLet's rock the boat...\n\n\nType Seshi.help() for help.. \n\n\n");
                    })(),
    help:function(){console.log("#\n" +
                        '# Usage:\n' + 
                        '#  Seshi.help() -- This menu\n' +
                        '#  Seshi.updateLocalFilesList() -- Refreshes the local file list\n' +
                        '#  Seshi.localFileList() -- Returns list of local files in Array of JSON objects\n' +
                        '#  Seshi.remoteFileList  -- Returns list of connected peers files (when connected)\n' +
                        '#\n\n\n' +
                        '#  ## The rest if Seshi is still being wrapped into the `Seshi.<call>` api ##\n' +
                        '#  ## for better code quality and to help make building user interfaces a much cleaner experience. ##\n' + 
                        '#      These will probably be named:\n' + 
                        '#          > Seshi.call() -- For contacting signaling server(s)\n' + 
                        '#          > Seshi.connect() -- Establish connection between peers\n' +
                        '#          > Seshi.getRemoteFileList() -- Fetch list from peer of their local files.\n' + 
                        '#          > Seshi.storeFile(fileObj)\n' +
                        '#          > Seshi.play() -- Returns blob url of file so UI can playback media. (see: https://goo.gl/mmPU9V)\n' + 
                        '#          > Seshi.status() -- Returns connection status. Either "connected" to peer or "disconnected".'
            ); return "🚀 🚀  Keep calm & Seshi on! 🚀 🚀"},
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
    sendLocalFileListToRemote:function(bool) {
        console.log("Should send my file list now over datachannel to peer..");
        //Send most up to date file listing or cached version?? hmm.
        //Prepare file list message to send to remote peer
        localFileList = JSON.stringify(Seshi.localFileList());
        msg = {"cmd":"recvRemoteFileList", "data":localFileList, "reply":bool};
        msg = JSON.stringify(msg);
        dc.send(msg);
    }
}//End Seshi :'(

//Initalize local files list cache if empty
if (!localStorage.getItem("localFilesList" || localStorage.getItem('localFilesList').length == 0)) {
    Seshi.updateLocalFilesList();
}//Load localFilesList if empty
