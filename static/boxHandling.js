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

};

