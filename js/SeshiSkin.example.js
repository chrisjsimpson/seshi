//Event listeners

//Generate Key button
generateKeyBtn = document.getElementById('setKey');
generateKeyBtn.addEventListener('click', createShareUrl, false);


function displayFiles() {
    fileList = Seshi.localFileList();
    table = '<h2>Your files:</h2>\n<table>\n';
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
                                    '<span data-id="' + fileList[i].fileId + '" onclick="share(event)"> Send to peer</span> / ' +
                                    //Play in sync action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="playInSync(event)"> Play in-sync with friend!</span> / ' +
                                    //Delete action
                                    '<span data-id="' + fileList[i].fileId + '" onclick="deleteFile(event)"> Delete file</span>' +
                                    
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
    //Scroll to media player
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
    var fileTable = document.getElementById('fileTable');
        fileTable.innerHTML = 'Refreshing file list.. <br /><img src="/img/Ajax-loader.gif" />';
    
    // Seshi..updateLocalFilesList() returns a promise, therefore we must 'wait' for it to resolve.
    Seshi.updateLocalFilesList().then( // .then() we know the .localFileList cache is updated, so we display the fresh list.
            function(complete){
                displayFiles();   
            });

}

function storeFile(fileList){
    Seshi.store({'dataSource':'fileSystem','data':fileList});
}

function deleteFile(event){
        fileId = event.target.dataset.id;
        alert("Deleting file...(refresh file list)");
        Seshi.deleteFile(fileId);
        Seshi.updateLocalFilesList();
}

function createShareUrl() {
    var key = Seshi.setKey();
    var shareUrl = document.location.origin + '?key=' + key;
    console.log("Generated share url: \n" + shareUrl);
    //Replace generate key button with welcome message 
    // & connect to signal server with key
    replaceGenerateKeyBtn();
}

function connectToSignalServer() {
    /* Connect established a signaling channell
     * A signalling channel is between THREE nodes:
     *   > Person A
     *   > Signaling Server
     *   > Person B
     * The signaling server passes messages containing
     * each person's connection information. 
     *
     * Once both persons have connection information for 
     * eachother, they can connect directly forming a 
     * peer-to-peer connection.
     */
     connect();
}

function replaceGenerateKeyBtn() {
    /* This replaces the generate key button with a 'connecting' message
     * note call connect() is automatically called by this function,
     * so that the user dosn't have to click anything.
     */

    generateKeyBtn = document.getElementById('setKey');

    var connectBtn = document.createElement('button');
    connectBtn.id = 'connect';
    connectBtn.className = 'button button--antiman button--round-l button--text-medium btn-generate-key';
    connectBTnText = document.createTextNode("Send your friend the key ->");
    connectBtn.appendChild(connectBTnText); 

    var parentDiv = generateKeyBtn.parentNode;
    parentDiv.replaceChild(connectBtn, generateKeyBtn);

    //send key to signaling server & wait for them to share their key with friend
    connectToSignalServer();

}


displayFiles();
