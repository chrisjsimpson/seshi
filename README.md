# Seshi
Seshi allows peers to store files in the browser, play them back &amp; share them with a friend . 
It is a web based peer to peer file sending program which combines webrtc with indexeddb. It's written in Javascript. 

# Seshi API 0.1
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

* [`.help`](#help)
* [`.store`](#store)
* [`.storeProgress`](#storeProgress)
* [`.connectionStatus`](#connectionStatus)
* [`.generateKey`](#generateKey)

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


###<a name="storeProgress">.storeProgress</a>
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


###<a name="generateKey">`.generateKey()`</a>

A key is needed for two peers to exchange their Candidate Addresses[^n] via a signalling server. A candidate address is **basically** an IP address & Port Number that a client *might* be able to be reached upon. This could be a local address, public IP address, Natted address, or the address of a TURN server to relay connections when a peer-to-peer connection cannot be established. See [^3]

Both peers send their candidate addresses to the signalling server, so that each peer can learn the candidate addresses of each other. 



[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCIceCandidate 
[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCIceConnectionState
[^n]: https://tools.ietf.org/html/rfc5245#section-2.1 
[^n]: http://w3c.github.io/webrtc-pc/#idl-def-RTCDataChannelState


## Why Seshi.io
Seshi started out of an idea to create a truly decentralised file sharing tool which would put people back in 
control of their own content. I was frustrated by parts of the internet being branded a metaphorical highways 
for piracy and unimpressed by services being capable of creating peer to peer file sharing tools, but chosing 
to collect email addresses, and perform analytics on users data for re-marketing campaigns thus loosing sight 
of the potential for pure peer to peer technologies.

Seshi is quite a geeky peice of tehnology, but it is nothing new. It's simply how its architected which makes 
it different. Seshi dosn't need <http://seshi.io> in order to function, that is, the web server on which it runs is not 
required in order for people to connect to each other. You can, for example save the webpage locally and run 
it from there. Signalling is still needed of course (ie how do users find each other) and for this, finally a 
valid use case for QR codes is found. Seshi can generate QR codes containing your connection information which 
can be exchanged outside of the application (a so-called out of band communication). 

The codebase is (almost) split into two parts: Seshi Skin & Seshi Signal, making it easier for developers to build their own interface whilst still 
plugging into Seshi's storage and p2p framework*.

* Use it / play with it here: http://seshi.io
* The supporting paper for this project is in the root directory of this repository. (Seshi Paper - A vendor agnostic, browser based peer to peer file backup application developed using web standards.pdf) 

