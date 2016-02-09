function displayFiles() {
    fileList = Seshi.localFileList();
    table = '<table>\n';
    theader = '<thead>\n' +
               '<tr class="header-row">\n' +
                    '<th class="fileName" class="ascending">Name</th>\n' +
                    '<th class="actions">Actions</th>\n' +
               '</thead>\n';

    tbodyStart = '<tbody>';
    tbodyContent = '';

        //Loop over local files list to create table body
        for (var i=0; i< fileList.length;i++) {
            tbodyContent += '<tr>\n' +
                                '<td data-col="fileName" data-id="' + fileList[i].fileId + '"' +
                                ' onclick="play(event)">' + fileList[i].fileName + '</td>\n' +
                                '<td data-col="actions">' +
                                    //Playback action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="play(event)">Play</span> / ' +
                                    //Download action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="download(event)">Download</span> /' +
                                    //Share action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="share(event)"> Send to peer</span>' +
                                    //Delete action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="delete(event)"> Delete file</span>' +
                                    
                                '</td>\n' +
                           '</tr>\n\n';
        }

    tbodyEnd = '</tbody>';
    tableOutput = table + theader + tbodyStart + tbodyContent + tbodyEnd + '</table>';
    //Update filetable
    var fileTable = document.getElementById('fileTable');
    fileTable.innerHTML = tableOutput;
}//End displayFiles

function play(event) {
    console.log("My player implimentation...");
    fileId = event.target.dataset.id;
    Seshi.play(fileId, "mediaInput");
}

function download(event) {
    fileId = event.target.dataset.id;
    Seshi.download(fileId);
}

function share(event) {
    //Check a peer is actually connect so we can send them the file
    if (Seshi.connectionStatus.dataChannelState() == "open") {
        fileId = event.target.dataset.id;
        Seshi.sendFileToPeer(fileId)
    } else { //Not connected to a peer!
        alert("You need to be connected to a peer in order to send them a file. Click button <x> or / automatically show share box to user...");
    }
}

function refreshFileList() {
    Seshi.updateLocalFilesList();
    alert("Refreshing file list..");
    window.setTimeout(displayFiles(), 5000);
}

function delete(fileId){
        fileId = event.target.dataset.id;
        alert("Hold on! Seshi.delete not yet moved into api"); 
}

displayFiles();
