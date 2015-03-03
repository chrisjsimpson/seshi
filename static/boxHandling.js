window.onload = function () { 
//Event listner to set Boxid
  window.boxId = 'myBoxID'; //Default box id
  var elm = document.getElementById("setBoxId");
  elm.addEventListener("click", setBoxId, false);

  function setBoxId(event)
  {
       var elm = document.getElementById("boxId");
       window.boxId = elm.value;
  }//End setBoxId



//Event listner for file downloading
  var showFiles = document.getElementById('showFiles');
  showFiles.addEventListener("click", showBoxFiles, false);

  function showBoxFiles(event)
  {
    console.log("Show files in box eventlistner called..."); 
    var filesInBox = document.getElementById('filesInBox');
    //Get list of files for given boxId.
    files = {
            fill:function(cb){
                db.transaction("rw", db.chunks, function() {
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
                var list = '<ul>';
                
                for(var i=0;i<fileNames.length;i++)
                {
                        list += '<li title="Download"><a class="fileDownload" href="';
                        list += 'index.html?download=';
                        list += fileNames[i].fileId;
                        list += '" data-fileId="';
                        list += fileNames[i].fileId;
                        list += '">';
                        list += fileNames[i].fileName;
                        list += '</a></li>';
			list += '<li><button class="shareFile" data-fileId="';
			list += fileNames[i].fileId;
			list += '">Share file</button></li>';
                }

                list += '</ul>';
                console.log(list);
                filesInBox.innerHTML = list;

                //Add event listeners to these files for downloading
                var downloads = document.getElementsByClassName('fileDownload');
                for(var i=0;i<downloads.length;i++)
                {
                    //Get fileId
                    var fileId = downloads[i];
                    //Add downloadFile event listener
                    fileId.addEventListener('click', downloadFile, false);
                }//End add download event listener to each file link.

		var shares = document.getElementsByClassName('shareFile');
		function shareFile(e) {
			//Get file id:
			var fileId = e.target.dataset.fileid;
			var sessionId = document.getElementById('key').value;
			var partnerInfo = {"sessionId": sessionId, "fileId": fileId};
			//Make QR code 
			var qrcode = new QRCode("qrcode");

			function makeCode () {      
			    qrcode.makeCode(JSON.stringify(partnerInfo));
			}

			makeCode();
		}//End shareFile	


		for(i=0;i<shares.length;i++) {
			shares[i].addEventListener('click', shareFile, false);
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
                }

                var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                url = window.URL.createObjectURL(file);
                console.log("Data: " + url);
                //Open file
                window.open(url);
            })
        
        }).then(function() {
            //Transaction completed

        }).catch (function (err) {
            
            console.error(err);
    
    });//End get fildIdChunks from fileId

}//End download file


function trythis(updates) {
    //console.log(updates[0].object.length);
}

document.getElementById('share').addEventListener('change', sendStoreMsg, false);

};
