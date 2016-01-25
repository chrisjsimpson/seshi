window.onload = function () { 

	//Check if zero signaling server, if none, add default
	signalServerDb.signalServers.count(
		function(count){ 
			if(count == 0)
			{
				signalServerDb.signalServers.add({address: "seshi.io",
				lastSuccessfulConnectTimestamp: null,
				lastConnectAttempTimestamp: null,
				numFailedConnectAttempts: null}).
		then(function(){
			alert('Inserted: ' + signalingServerAddress.value);
		}).catch(function(error) {
			console.error(error);
		});//End insert new singalingServerAddress
				
			}//Add a default signal server
		console.log("There are " + count + " objects");
		})

	//End check if zero signaling servers, if none, add a default.

		//Event listener for generating new key
		var generateBtn = document.getElementById('generateKey');
		generateBtn.addEventListener('click', generateNewKey, false);

		function generateNewKey() {
			document.getElementById('key').value = generateKey();
		}

//Event listner to set Boxid
  window.boxId = 'myBoxID'; //Default box id
  var elm = document.getElementById("setBoxId");
  //elm.addEventListener("click", setBoxId, false);

  function setBoxId(event)
  {
       var elm = document.getElementById("boxId");
       window.boxId = elm.value;
  }//End setBoxId


//Event listener for SyncMyData Syncing user data
var SyncMyData = document.getElementById('SyncMyData');
SyncMyData.addEventListener('click', sendAllDataToPeer, false);
function sendAllDataToPeer() {
    db.transaction('r', db.chunks, function() {
            db.chunks.each(function(chunk) {
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
                                        //for(var i=0;i<=99999999;i++) {}//Crude delay!
                                        dc.send(result = file.target.result);
                                }//End FileReader.DONE
                        }//End reader.onload
                        reader.readAsArrayBuffer(sendChunk);
                        //End sending file meta
            })//End db.chunks toArray using Dexie (.then follows)

        }).then(function() {
            //Transaction completed
		console.log("All chunks (all files) sent to connected peer!");
		alert("All chunks (all files) sent to peer");
        }).catch (function (err) {
            console.error(err);
    });//End get fildIdChunks from fileId
}//End SyncMyData sendAllDataToPeer

//Event listener for QR code reader
var readQrCodeBtn = document.getElementById('readQrCode');
//readQrCodeBtn.addEventListener("change", readQrCode, false);

function readQrCode(evt) {

	var canvas = document.getElementById('qrlogo_canvas');
	var ctx = canvas.getContext('2d');
	var files = evt.target.files; // FileList object
	var theFile = files[0];

	var reader = new FileReader();

	reader.onload = ( function(e) {
		var img = new Image();
		img.onload = function() {  
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img,0,0);
		};
		img.src = e.target.result; 
		evt = null;
		canvas_loader(evt, document.getElementById("qrlogo_canvas"), theFile , qrdecode_ondecode);
	});

	// Read in the image file as a data URL.
	reader.readAsDataURL(theFile);
	window.setTimeout(function() {
		console.log("About to call clickCallBtn");
		clickCallBtn();
	}, 9000);
	
}//end readQrCode(e) 

/*********************************************************************/

//Event listener for when key is updated:
var key = document.getElementById('key');
key.addEventListener("change", clickCallBtn, false);

function clickCallBtn() {
	console.log("Clicking call button");
	document.getElementById('call').click();

	//Request file download from peer.
	window.setTimeout(function() {
		console.log("Calling requestFileFromConnectedPeer()");
		requestFileFromConnectedPeer();
		}, 8000);
	
}//End clickCallBtn();

function requestFileFromConnectedPeer() {
	console.log("Called requestFileFromConnectedPeer.");
	var seshpack = JSON.parse(document.getElementById('qrlogo_text').value);
	
	var fileId = seshpack.fileId; //Get fileID requested
	var chunksNeeded = seshpack.numberOfChunks; //Get number of chunks to file.
	
	//Send request for file to already connected peer
	var msg = {"requestFileId":fileId};
	msg = JSON.stringify(msg);
}//requestFileFromConnectedPeer()


/*********************************************************************/

//Event listner for file downloading
  var showFiles = document.getElementsByClassName('showFiles');
	for(var i=0;i<showFiles.length;i++)
	{
		showFiles[i].addEventListener("click", showBoxFiles, false);
	}

  function showBoxFiles(event)
  {
    console.log("Show files in box eventlistner called..."); 
    var filesInBox = document.getElementById('filesInBox');
    //Get list of files for given boxId.
    files = {
            fill:function(cb){
                db.transaction("r", db.chunks, function() {
                var i = 0;
                var sum = 0;
                var count = 0;
                var id = '';
                db.chunks.where('boxId').equals(window.boxId).each(
                    function(boxChunks) {
                        //console.log(boxChunks.fileId);
                       
                        if(id != boxChunks.fileId)
                        {
                            files.chunks[i] = {fileId:boxChunks.fileId, fileName: boxChunks.fileName};            
                            i++;
                        }
                        id = boxChunks.fileId;
                        //console.log("Comparing: '" + files.chunks[sum].fileId + "' with: '" + boxChunks.fileId);
                                //Check Array.observe exists
                                if(typeof Array.observe != "undefined")
                                {
                                 Array.observe(files.chunks, trythis);
                                }
                        })//End get fileList 
                        files.readyState = 'DONE';
           }).then(function() {

                         files.chunks.forEach(function(elm) {
                                        //console.log(elm);
                                    });
                var fileNames = [];
                fileNames = files.chunks;
                console.log("There are currently " + fileNames.length + " files in boxId: " + window.boxId);

                for(var i=0; i< fileNames.length;i++) {
                    console.log(fileNames[i].fileId);
                }

                //Update files list box
                var filesInBox = document.getElementById('filesInBox');
                
		var list = '<div class="container"><div class="row">';
                
                for(var i=0;i<fileNames.length;i++)
                {
			list += '<div class="col-xs-12 col-sm-4 col-md-3"><div class="thumbnail"><div class="caption">';

			list += '<p>' + fileNames[i].fileName.substr(0,50) + '...</p>';

			list += '<button class="label label-info send" data-fileId="' + fileNames[i].fileId + '">Send</button>  ';

			list += '<button class="label label-default fileDownload" data-fileId="' + fileNames[i].fileId + '">Download</button>  ';
			
			list += '<button class="label label-default deleteFile" data-fileId="' + fileNames[i].fileId + '">Delete</button></p>';
		
			if(isPlayable(fileNames[i].fileName)) {	
				list += '<p><button class="label label-default">Play in-sync with a friend!</button></p>';
			}

			list += '</div>';
		
			list += '<img src="http://i57.tinypic.com/xqeyaw.jpg" alt="...">';

			list += '</div></div>'
		/*
                        list += '<li title="Download" class="list-group-item"><a class="fileDownload" href="';
                        list += 'index.html?download=';
                        list += fileNames[i].fileId;
                        list += '" data-fileId="';
                        list += fileNames[i].fileId;
                        list += '" onclick="scroll(0,0)">';
                        list += fileNames[i].fileName;
                        list += '</a> ';
			/* Download button 
			list += '<button class="btn pull-right fileDownload" data-fileId="';
			list += fileNames[i].fileId;
			list += '">Download</button>';
			/* Play button 
			list += '<button class="btn btn-success pull-right play" data-fileId="';
			list += fileNames[i].fileId + '"';
				/* Disable play button on non media 
				if(!isPlayable(fileNames[i].fileName)) {
					list += " disabled";
				}
			list += '>Play</button>';
			/* Send button 
			list += '<button class="btn btn-primary pull-right send" data-fileId="';
			list += fileNames[i].fileId;
			list += '">Send</button>';
			/* Delete button 
			list += '<button class="btn btn-danger btn-sm pull-right deleteFile" data-fileId="';
			list += fileNames[i].fileId;
			list += '">Delete File</button>  ';
			//list += '<button class="shareFile" data-fileId="';
			//list += fileNames[i].fileId;
			//list += '">Generate QR Code</button>';
			//list += '<button class="downloadFileMobile" data-fileId="';
			//list += fileNames[i].fileId + '">';
			//list += 'Download file Mobile</button>';
			*/
                }

                list += '</ul>';
                console.log(list);
                filesInBox.innerHTML = list;

		//Add each file to playlist
		playlistItems = '<h2>Playlist:</h2><ul>'
	                for(var i=0;i<fileNames.length;i++)
			{
				if(isPlayable(fileNames[i].fileName)) {
					playlistItems += '<li class="playlistItem play" data-fileId="' + fileNames[i].fileId + '">' + fileNames[i].fileName + '</li>';
					//playlistItems += '<img src="http://i57.tinypic.com/xqeyaw.jpg" title="Seshi" />';
				}
			}
		playlistItems += '</ol>';
		var playlist = document.getElementById('playlist');
		playlist.innerHTML = playlistItems;
		//End add each file to playlist

                //Add event listeners to these files for downloading
                var downloads = document.getElementsByClassName('fileDownload');
                for(var i=0;i<downloads.length;i++)
                {
                    //Get fileId
                    var fileId = downloads[i];
                    //Add downloadFile event listener
                    fileId.addEventListener('click', downloadFile, false);
                }//End add download event listener to each file link.


                //Add event listeners to these files for playing
                var downloads = document.getElementsByClassName('play');
                for(var i=0;i<downloads.length;i++)
                {
                    //Get fileId
                    var fileId = downloads[i];
                    //Add downloadFile event listener
                    fileId.addEventListener('click', playMedia, false);
                }//End add download event listener to each file link.
                
		//Add event listeners for deleting a single file 
		var deleteCandidates = document.getElementsByClassName('deleteFile');
                for(var i=0;i<deleteCandidates.length;i++)
                {
                    //Get fileId
                    var fileId = deleteCandidates[i];
                    //Add delete  event listener
                    fileId.addEventListener('click', deleteFile, false);
                }//End add deleteFileevent listener to each file link.
		//End deleteFile event listener


		function deleteFile(e) {
			var fileId = e.target.dataset.fileid;
			db.chunks.where("fileId").equals(fileId).delete()
			.then(function(deleteCount) {
			 console.log("Deleted: " + deleteCount + " chunks. Of fileId: " + fileId );
			 showBoxFiles(); //Reload files list
			});
		}//End delete file



		var shares = document.getElementsByClassName('shareFile');
		function shareFile(e) {
			//Get file id:
			var fileId = e.target.dataset.fileid;
			//Get number of chunks this file has
			var numChunks = 0;
			
			db.chunks.where("fileId").equals(fileId).first(function(chunks) {
			console.log("There are: " + chunks.numberOfChunks + " chunks to this file in total.");
			var numChunks = chunks.numberOfChunks;
			return numChunks;
			//End query fileId's complete number of chunks from indexedDB
			}).then(function(numChunks) {
				console.log("Ready..");
				var sessionId = document.getElementById('key').value;
				var partnerInfo = {"sessionId": sessionId, "fileId": fileId,"numberOfChunks": numChunks};
				//Make QR code 
				var qrcode = new QRCode("qrcode");

				function makeCode () {      
				    qrcode.makeCode(JSON.stringify(partnerInfo));
				}

				makeCode();
				//Auto connect
				window.setTimeout(function() {
						document.getElementById('connect').click();
						}, 8000);
			});
		}//End shareFile	


		for(i=0;i<shares.length;i++) {
			shares[i].addEventListener('click', shareFile, false);
		} 
		
		var sendButtons = document.getElementsByClassName('send');
		for(i=0;i<sendButtons.length;i++) {
			sendButtons[i].addEventListener('click', sendChunksToPeer, false);
		} 
		

            }).catch(function(err) {
                    console.log(err);
                });
            },
            chunks:[],
            readyState:''
    }//End files object


files.fill(trythis);

  }//End showBoxFiles()

function downloadFile(event) {
    event.preventDefault();    
    var fileId = event.target.getAttribute('data-fileid');

    //Query IndexedDB to get the file
    db.transaction('r', db.chunks, function() {
        
            db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                //Transaction scope
                console.log("Found " + chunks.length + " chunks");
                
                var allChunksArray = [];
                //Just get blob cunks
                for(var i=0;i<chunks.length; i++){
                    //console.log(found[i].chunk);
                    allChunksArray[i] = chunks[i].chunk
                }//End put all chunks into all chunks array

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

}//End download file


function playMedia(event) {
    event.preventDefault();    
    var fileId = event.target.getAttribute('data-fileid');

    //Query IndexedDB to get the file
    db.transaction('r', db.chunks, function() {
        
        
        }).then(function() {
            //Transaction completed
            db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                //Transaction scope
                console.log("Found " + chunks.length + " chunks");
                
                var allChunksArray = [];
                //Just get blob cunks
                for(var i=0;i<chunks.length; i++){
                	allChunksArray[i] = chunks[i].chunk
                }//End put all chunks into all chunks array

                var file = new Blob(allChunksArray, {type:chunks[0].fileType});
		console.log(chunks[0].fileType);
                url = window.URL.createObjectURL(file);
		console.log("Data: " + url);

		var video = document.getElementById('video');
		var obj_url = window.URL.createObjectURL(file);
		video.style.display = "inline-block";
		video.src = obj_url;
		video.addEventListener('canplay', function() {
			if ( video.readyState == 4 ) 
			{
				video.play(); 
			}
		})
		//Simply download file if on mobiles
		if( window.screen.width < 700 )
		{
			var a = document.createElement("a");
			document.body.appendChild(a);
			a.style = "display: none";
			a.href = url;
			a.download = chunks[0].fileName;
			a.click();
		}//End simply download if on a mobile.

            })//End db.chunks toArray using Dexie (.then follows)
        }).catch (function (err) {
            
            console.error(err);
    
    });//End get fildIdChunks from fileId

}//End playMedia()

function isPlayable(fileName) {
	/* Mp3 */
	fileName = fileName.toLowerCase();
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
	
	/* ogg */
	if (fileName.indexOf('.ogg') > -1) {
		return true;
	}

	/* ### Images ### */
	
	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return false;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return false;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return false;
        }

	/* ### Documents ### */

	/* pdf */
	        if (fileName.indexOf('.pdf') > -1) {
                return false;
        }
	
	// Presume playable 
	return true
} //End isPlayable()

function isImage(fileName) {

	/* MY FIDDLE: http://jsfiddle.net/fua75hpv/80/ */

	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return true;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return true;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return true;
        }

	return false;
}//End isImage(fileName)


function trythis(updates) {
    //console.log(updates[0].object.length);
}

function generateCode() {

//Remove any existing code from display:
if( document.getElementById('QrImg') ) {
	document.getElementById('QrImg').remove() ;
}
var sessionId = document.getElementById('key').value;
var partnerInfo = {"sessionId": sessionId};
//Make QR code 
var qrcode = new QRCode("qrcode");

function makeCode () { 
    qrcode.makeCode(JSON.stringify(partnerInfo));
}
makeCode();
//Auto connect
window.setTimeout( function() {
		document.getElementById('connect').click();
	       }, 8000);
}//End generateCode 

document.getElementById('share').addEventListener('change', sendStoreMsg, false);
document.getElementById('Generate').addEventListener('click', generateCode, false);


/* Video */
var video_player = document.getElementById("video_player"),
links = video_player.getElementsByTagName('a');
for (var i=0; i<links.length; i++) {
	links[i].onclick = handler;
}

function handler(e) {
	e.preventDefault();
	videotarget = this.getAttribute("href");
	filename = videotarget.substr(0, videotarget.lastIndexOf('.')) || videotarget;
	video = document.querySelector("#video_player video");
	video.removeAttribute("controls");
	video.removeAttribute("poster");
	source = document.querySelectorAll("#video_player video source");
	source[0].src = filename + ".mp4";
	source[1].src = filename + ".webm";
	video.load();
	video.play();    
}

/* End video */

};
