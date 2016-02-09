window.onload = function () { 

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
                var id = '';
                var i = 0;
                db.chunks.where('boxId').equals(Seshi.boxId).each(
                    function(boxChunks) {
                        if(id != boxChunks.fileId)
                        {
                            files.list[i] = {fileId:boxChunks.fileId, fileName: boxChunks.fileName};            
                            i++;
                        }
                        id = boxChunks.fileId;
                        })//End get fileList 
           }).then(function() {

                fileNames = files.list;
                console.log("There are currently " + fileNames.length + " files in boxId: " + Seshi.boxId);
                
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
                }

                list += '</ul>';
                filesInBox.innerHTML = list;

		//Add each file to playlist
		playlistItems = '<h2>Playlist:</h2><ul>'
	                for(var i=0;i<fileNames.length;i++)
			{
				if(isPlayable(fileNames[i].fileName)) {
					playlistItems += '<li class="playlistItem play" data-fileId="' + fileNames[i].fileId + '">' + fileNames[i].fileName + '</li>';
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
            list:[],
            readyState:''
    }//End files object


files.fill();

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
