//Get list of files for given boxId.
var localFileListBuilder = {
	list:[],
	buildList:function(){ 
		if ( 'undefined' === typeof window){
			importScripts("../../Dexie.js");
			importScripts("../../databaseSchema.js");
		}
		db.transaction('r', db.chunks, function()

		{db.chunks.each(function(chunk) { 
			if(localFileListBuilder.id != chunk.fileId)
			{
				var file = {
						"fileId":chunk.fileId,
						"boxId": chunk.boxId,
						"fileName":chunk.fileName,
						"fileType":chunk.fileType
					   };

				localFileListBuilder.list.push(file);
			}//End prevent storing filename multiple times
			localFileListBuilder.id = chunk.fileId; //Prevent storing filename multiple times
			})
		}).then(function() {
			self.postMessage({'type':'data', 'fileList':localFileListBuilder.list});
            close(); //Close the worker
		})
	}
}

//Listen for request for fileList
self.onmessage = function(e) {
	 localFileListBuilder.buildList();
}
