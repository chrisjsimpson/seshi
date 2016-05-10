//Catch those errors! Cred @eric bidelman
function onError(e) {
    postMessage('ERROR: ' + e.toString());
}

//Wrapp worker in try/catch in order to send any errors
//back to the window object.

try { //This try wraps the entire worker!

//Import Dexie
if ( 'undefined' === typeof window){
            importScripts("../../Dexie.js");
            importScripts("../../databaseSchema.js");
            importScripts("core.js");
            importScripts("md5.js");
            importScripts("sha1.js");
            importScripts("sha256.js");
        }

//Get handle to files wanting to be stored by user/datachannel.
self.onmessage = function(msg) {
    console.log(msg);
    storeRequest = msg.data;
/*
 *  -- Get storage request message --
 *  Message object should be given in the following format:
 *
 *  {
 *      "dataSource":"fileSystem || seshiChunk",
 *      "data":"File object || Seshi ArrayBuffer packet
 *  }
 *
 *  If dataSource is 'fileSystem' then 'data' should be a File 
 *  list object (https://developer.mozilla.org/en/docs/Web/API/FileList)
 *  each file in the file list object will then be chunked & stored 
 *  into Seshi's IndexedDB.
 *
 *  If dataSource is 'seshiChunk', it should be a Seshi chunk of type 
 *  arrayBuffer. Each chunk will be stored directly into Seshi's 
 *  IndexedDB.
 *
*/
    //Determine data input source (fileSystem or seshiChunk)
    switch(storeRequest.dataSource)
    {
        case "fileSystem":
            storeFiles(storeRequest.data);
            break;
        case "seshiChunk":
            console.log("caught seshiChunk store req");
            storeChunk(storeRequest);
            break;
    }//End switch to determine data input source


}//End onmessage handler for storeFileDexieWorker

const CHUNKSIZE = 24512;
var fr = new FileReader();
var currentFile = 0;

function storeFiles(files) {
    var file = files[currentFile];
    var fileName = file.name;
    var fileType = file.type;
    var fileSize = file.size;
    var numChunksNeeded = Math.ceil(fileSize/CHUNKSIZE);
    var currentChunkNum = 0;
    var offset = 0;
    var hash = '';
    var md5Hash = CryptoJS.algo.MD5.create();
    var sha1Hash = CryptoJS.algo.SHA1.create();

    hashFile();
    function hashFile()
    {
        var readChunkPromise = new Promise(function(resolve, reject) {
            //Take a slice off the file & hash it..
            console.log("Taking from offset: " + offset);
            //Take chunk of file
            var blob = file.slice(offset, offset + CHUNKSIZE);

            //Read blob as array buffer then convert to wordArray for CryptoJS
            fr.onload = function(event) {
                var arrayBuff = event.target.result;
                console.log('The hash is:');
                var wordArray = arrayBufferToWordArray(arrayBuff);
                hash += CryptoJS.SHA1(wordArray);
                md5Hash.update(wordArray) //Update MD5 hash
                sha1Hash.update(wordArray); //Update SHA1 hash
                console.log(hash);

                //Update current chunk count
                currentChunkNum = currentChunkNum + 1;

                //Update offset for next iteration
                offset += CHUNKSIZE;
                resolve();

            }//End blob read as array buffer
            fr.readAsArrayBuffer(blob);
            console.log(blob);
            console.log("Length is: " +  blob.size);
        });
        readChunkPromise.then( //Read next chunk of file
          function() {
              if (offset < fileSize)
              {
                //Post store progess update to UI
                postMessage({
                            "type":"storageProgressUpdate",
                            "fileId":sha1Hash.toString(),
                            "fileName":fileName,
                            "currentChunk":currentChunkNum,
                            "totalNumChunks":numChunksNeeded,
                            "status":"Crunching"
                            }); 
                hashFile();
              } else {

                md5Hash = md5Hash.finalize();
                sha1Hash = sha1Hash.finalize();
                console.log('Storing in IndexedDB');
                currentChunkNum = 0;
                offset = 0;
                storeFile();
                function storeFile()
                {
                    console.log('Time to store: ' + fileName);
                    console.log('With hash: ' + sha1Hash);
                    console.log('File handle:');
                    console.log(file);
                    var storeChunkPromise = new Promise(function(resolve, reject) {
                        //Take a slice off the file & store it..
                        console.log("Taking from offset: " + offset);
                        //Take chunk of file
                        var blob = file.slice(offset, offset + CHUNKSIZE);

                        fr.onload = function(event) {
                            var arrayBuff = event.target.result;

                            //Update offer for next iteration   
                            offset += CHUNKSIZE;
                            //Store in IndexedDB
                            db.chunks.add({
                                        fileId:sha1Hash.toString(),
                                        boxId: 'myBoxID',
                                        fileName: fileName,
                                        fileType: fileType,
                                        chunkNumber: currentChunkNum,
                                        numberOfChunks: numChunksNeeded,
                                        chunkSize: arrayBuff.byteLength,
                                        chunk:arrayBuff,
                                        hash:hash.toString(),
                                        md5Hash:md5Hash.toString(),
                                        sha1Hash:sha1Hash.toString()
                            }).then(function(){
                                //Update current chunk count
                                currentChunkNum = currentChunkNum + 1;
                                resolve();
                            });
                        }//End blob read as array buffer
                        fr.readAsArrayBuffer(blob);
                        console.log(blob);
                        console.log("Length is: " +  blob.size);
                    });//End storeChunkPromise

                    storeChunkPromise.then( //Read next chunk of file
                        function() {
                            //Post store progess update to UI
                            postMessage({
                                        "type":"storageProgressUpdate",
                                        "fileId":sha1Hash.toString(),
                                        "fileName":fileName,
                                        "currentChunk":currentChunkNum,
                                        "totalNumChunks":numChunksNeeded,
                                        "status":"Storing"
                                        }); 
                            if (offset < fileSize)
                            {
                                storeFile();
                            } else {
                                //Check for additional files to process
                                currentFile = currentFile + 1;
                                if (files[currentFile] !== undefined)
                                {
                                    storeFiles(files);//Hash & Store next file
                                } else {
                                    //Show status complete.
                                    postMessage({
                                                "type":"storageProgressUpdate",
                                                "fileId":sha1Hash.toString(),
                                                "fileName":fileName,
                                                "currentChunk":currentChunkNum,
                                                "totalNumChunks":numChunksNeeded,
                                                }); 
                                    //Reset current file index
                                    currentFile = 0;
                                }//End if no more files to process, we are complete
                          }
                        });
            }//End storeFile()
            return hash;
          } //End if file has been completly stored, check for additional files.
      }); //End readChunkPromise complete
    }//End hashFile();



}//End storeFiles(fileList)


function storeChunk(seshiChunk) {

    console.log("Recived req to store chunk in webworker.");
    console.log(seshiChunk);

    //Store chunk into Seshi's indexedDB
    db.transaction("rw",db.chunks, function() {
        db.chunks.add({
                    fileId: seshiChunk.fileId,
                    boxId: 'myBoxID',
                    fileName: seshiChunk.fileName,
                    fileType: seshiChunk.fileType,
                    chunkNumber: seshiChunk.chunkNumber,
                    numberOfChunks: seshiChunk.numberOfChunks,
                    chunkSize: seshiChunk.chunkSize,
                    chunk: seshiChunk.chunk
        });
        
    }).then(function(done){
                    console.log('Celebrate');
                    //Post storage progress update to main thread
                    postMessage({
                            "type":"storageProgressUpdate",
                            "fileId":seshiChunk.fileId,
                            "fileName":seshiChunk.fileName,
                            "currentChunk":seshiChunk.chunkNumber,
                            "totalNumChunks":seshiChunk.numberOfChunks
                    });
                    //close();//Close worker thread upon storing the chunk. No need to close as on persistent worker
                    console.log("Stored a chunk over RTCdatachannel inside worker");
    
    }).catch(function(e){
                    console.log("Error:::: " + e);  
                    postMessage({"type":"error",
                                "msg":e});
    });

}//End storeChunk()

uuid = function()
{   /* Credit http://stackoverflow.com/a/2117523 */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
    });
}

/* File digest generation
Credit MDN: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
*/

function sha256(buffer) {
  // We transform the string into an arraybuffer.
  return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
    return hex(hash);
  });
}

function hex(buffer) {
  var hexCodes = [];
  var view = new DataView(buffer);
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue);
  }

  // Join all the hex strings into one
  return hexCodes.join("");
}

/* End file digest generation */


} catch (e) {//End of try
    onError(e);
}//End of try/catch which wrapps the entire worker.

function arrayBufferToWordArray(ab) {
/* Credit http://stackoverflow.com/questions/33914764/how-to-read-a-binary-file-with-filereader-in-order-to-hash-it-with-sha-256-in-cr */
  var i8a = new Uint8Array(ab);
  var a = [];
  for (var i = 0; i < i8a.length; i += 4) {
    a.push(i8a[i] << 24 | i8a[i + 1] << 16 | i8a[i + 2] << 8 | i8a[i + 3]);
  }
  return CryptoJS.lib.WordArray.create(a, i8a.length);
}
