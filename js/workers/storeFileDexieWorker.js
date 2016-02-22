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
            storeChunk(storeRequest.data);
            break;
    }//End switch to determine data input source


}//End onmessage handler for storeFileDexieWorker


function storeFiles(fileList) {
/* Takes Filelist object, chunks and stores each file
 * into Seshi's indexedDB
*/
    console.log("Storing files using storeFileDexieWorker. Start.");
    console.log(fileList);
    
    //Loop through each file, chunk and store it
    for (var i=0; i< fileList.length; i++) {
        console.log("At file: " + fileList[i].name);
        currentFile = fileList[i];
        //Get file metadata

        var reader = new FileReader();
            reader.onload = function(file) {
                if ( reader.readyState == FileReader.DONE) {
                    result = file.target.result;
                    console.log("File size is: " + result.byteLength);//Get file size
                    var fileSize = result.byteLength;
                    //Begin chunking...
                    var maxChunkSize = 24512; //bytes
                    console.log("Chunk size is set to: " + maxChunkSize + " bytes.");
                    var numChunksNeeded = Math.ceil(fileSize/maxChunkSize);
                    console.log("We need " + numChunksNeeded + " chunks. (" + fileSize +"/" + maxChunkSize + ")");
                    var start = 0;
                    var end = maxChunkSize;
                    fileId = uuid();
                    //Piece by piece, take maxChunkSize sized piexes of file.target.result and store them to IndexedDB
                    for(var chunkNum=0; chunkNum<= numChunksNeeded; chunkNum++)
                    {   
                        db.transaction("rw", db.chunks, function() {
                        var chunk = result.slice(start,end);
                        var currentChunkNumTransactionScope = chunkNum; //Without this, for loop will complete (out of scope) immediatly to value  of <= numChunksNeeded
                            db.chunks
                                .add({
                                    fileId: fileId,
                                    boxId: 'myBoxID',
                                    fileName: currentFile.name,
                                    fileType: currentFile.type,
                                    chunkNumber: chunkNum,
                                    numberOfChunks: numChunksNeeded,
                                    chunkSize: chunk.byteLength,
                                    chunk: chunk
                                }).catch(function(error) {
                                        console.log(error)
                        }).then(function() {
                            //Check if storage is complete
                            //Post storage progress update to main thread
                            postMessage({
                                    "type":"storageProgressUpdate",
                                    "fileId":fileId,
                                    "fileName":currentFile.name,
                                    "currentChunk":currentChunkNumTransactionScope,
                                    "totalNumChunks":numChunksNeeded,
                            });
                        }).catch(function(error) {
                            console.err(error);
                        })})
                        start = start + maxChunkSize;//Shift up to next bytes from file.target.result
                        end = end + maxChunkSize; 
                    }//End Piece by piece, take a chunk of the file.target.result, and store it to IndexedDB
                }//End reader.readyState == DONE
            }//End reader.onload
            reader.readAsArrayBuffer(currentFile);
    }//End loop through each file, chunk and store it.

}//End storeFiles(fileList)

uuid = function()
{   /* Credit http://stackoverflow.com/a/2117523 */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
    });
}


} catch (e) {//End of try
    onError(e);
}//End of try/catch which wrapps the entire worker.