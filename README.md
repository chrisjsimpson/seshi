Seshi is a web api which wrapps WebRTC & IndexedDB features from the html5 spec. It allows the ***decentralised storage of large files in the browser*** (IndexedDB), you can then ***send files direct to peers*** (WebRTC) and ***playback the files  within the browser*** (e.g. Video and audio).

We are launching [Seshi](http://seshi.io) to the public, please [register your interest](http://seshi.io/register) to get early access when we release Seshi pro (whatever *pro* means these days) to fund further development.

*This API is subject to change, so please be ready for some of the API calls to change, or be removed in some way as the application matures.*

* **Storage:** IndexedDB
* **Peer to Peer File Transfer:** WebRTC Data channel
* **Media playback**: Any browser supported format 
* **Chat:** WebRTC Data channel

TODO: Add complete example for creating peer connection using API.

##API Calls
All api calls are prefixed with `Seshi.<api call>`

> Call [`Seshi.help()`](#help) at any time in console to view the list of Seshi commands.

###Settings Related API Calls

* [`.setBoxId(boxName)`](#setBoxId) - Associates files with boxes, similar to the folder concept.

* [`.getBoxId()`](#getBoxId) - Get current Seshi.boxId

* [.generateKey](#markdown-header-generateKey) - Return a key (string). Used when setting up a peer connection. This is used by the signalingServer.

* [`.addSignalingServer("example.com")`](#addSignalingServer) - Add additional signaling server(s)

* [`.connectionStatus`](#connectionStatus) - Query peer connection state

## Storage operations

* [`.store(storeReqObj)`](#store) - Store data into Seshi's Data Store 

* [`.storeProgress`](#storeProgress) - Query file storing  progress

* [`.localFileList()`](#localFileList) - Returns list of local files in Data Store

* [`.updateLocalFilesList`](#updateLocalFilesList) - Refreshes the *cached* local file list 

* [`.deleteFile(fileId)`](#deleteFile) - Delete file from Seshi

* [`.download(fildId)`](#download) - Download file from IndexeDB to users local filesystem.


##Peer to Peer operations
* [`.sendFileToPeer(fileId)`](#sendFileToPeer) - Send file to peer over DataChannel.

* [`.sendLocalFileListToRemote()`](#sendLocalFileListToRemote) -- Send local filelist to peer. Peer automatically replies with their `.localFileList()` which populates Seshi.remoteFileList 

* [`.remoteFileList`](#remoteFileList) - Returns list of connected peers files (when connected)

* [`.syncData()`](#syncData) -- Send all data to connected peer.

## Media operations
* [`.play(fileId, element)`](#play) - Playback file in the browser

----
###<a name="storeProgress">`.help()`</a>
Display the help menu.

###<a name="store">`.store(StoreReqObject)`</a>
Store data into Seshi's IndexedDB database. 

Seshi can store data into its database directly from the users file system via an `<input type="file" multiple>` or receive and store data coming from a connected peer over the RTCdatachannel piece by piece.

######Storing files from a file input: 
    var StoreReqObject =
    {
        'dataSource':'fileSystem',
        'data':this.files
    }
*this.files* should be File object from the `<input type=file ...>` 
Seshi will then:

* Loop through each file the user has specified
* Split it into small chunks
* Store each chunk into IndexedDB.

###Store data coming from a connected peer

    var StoreReqObject =
    {
        'dataSource':'seshiChunk',
        'data':chunk
    };
    Seshi.store(StoreReqObject);

*Chunk* must be a single Seshi chunk taken from the IndexedDB of a connected peer. This is then stored in the receiving peers' Seshi database. 


###<a name="connectionStatus">`.connectionStatus`</a> 
Returns object containing iceConnectionState[^n] & dataChannelState[^n]

To get the iceConnectionState query: `Seshi.connectionStatus.iceConnectionState()`

To get the DataChannel State  query:
`Seshi.connectionStatus.dataChannelState()`


###<a name="storeProgress">`.storeProgress`</a>
Use this call to query the progess of files being stored into Seshi. Storing a file takes time, because Seshi chunks files into ~65k chunks. 

`.storeProgress` Is an array of files currently being stored into Seshi indexed by their unique FileId. 


You can query the keys of this array to find out the store progress of each file:

    var keys = Object.keys(Seshi.storeProgress)

For example: 
`Seshi.storeProgress['b5ece06f-4b0a-4158-95dc-e24618a647bd']` where the index is a known FileId.

It's output is a list of the code above shows the names of files being stored and their progress:

    //Output 
    {
        fileName: "video.ogv",
        currentChunk: 629, 
        totalNumChunks: 729, 
        complete: false
    }

###<a name="deleteFile">`.deleteFile(fileId)`</a>
Remove a file from Seshi's database.

    Seshi.deleteFile(fildId);

Get the list of fileIds currently in the database by calling:

    Seshi.localFileList();

> `.localFileList` is a *cached list* of all files in Seshi's database. This makes it quicker to retrieve a list of all files in the database. To refresh this cache, call `Seshi.updateLocalFilesList()` 

###<a name="localFileList">`.localFileList()`</a>
Returns an array of objects, one for each file. This is a cached list of file names in Seshi's data store for speed. To update the file list cache call `Seshi.updateLocalFilesList()` 

Usage: 

    var list = Seshi.localFileList();

Returns array of objects containing information about each file stores in Seshi: 

    [Object, Object, Object...];
    console.log(list[0]); //Object:
  
    Object {
        fileId: "086059ca-f03e-42a5-9ff4-0e80baab2a8c", 
    boxId: "myBoxID", 
    fileName: "Happy Birthday.flac", 
    fileType: "audio/mp3"
    }

###<a name="updateLocalFilesList">`.updateLocalFilesList()`</a>

Refreshes Seshi's cached `.localFileList()` call. It quires the entire IndexedDB for every FilId, and then reports back to `Seshi.localFileList()` with the most up-to-date list of files in the Data store. 

This api call is ***intensive*** because it looks at every chunk in the Data Store. 

> The implementation of this is subject to change to improve its speed. An index will probably be added on 'FileName' of each chunk to make this faster in the future.[^n]

## generateKey

A key is needed for two peers to exchange their Candidate Addresses[^n] via a signalling server. A candidate address is **basically** an IP address & Port Number that a client *might* be able to be reached upon. This could be a local address, public IP address, Natted address, or the address of a TURN server to relay connections when a peer-to-peer connection cannot be established. See [^3]

Both peers send their candidate addresses to the signalling server, so that each peer can learn the candidate addresses of each other. 

    var key = Seshi.generateKey();
    console.log(key); //xyz
    Seshi.connect(key); //See docs



[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCIceCandidate 
[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCIceConnectionState
[^n]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Concepts_Behind_IndexedDB#gloss_key 
[^n]: https://tools.ietf.org/html/rfc5245#section-2.1 
[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCDataChannelState