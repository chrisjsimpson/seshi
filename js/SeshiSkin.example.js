/* Event listeners:
 * - For a cleaner UI developer experience by
 *   avoiding inline Javascript e.g: onclick="example()"
 *
 * Rather than interfere with the UI like this,
 * attach event listeners to the UI components which 
 * trigger events. 
 * For example:
 *
 * When user clicks generate key button, register an 
 * event which responds to this action & call the
 * function responsible for generating a share url.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
*/

//Event: When user clicks generate Key button 
generateKeyBtn = document.getElementById('setKey');
generateKeyBtn.addEventListener('click', createShareUrl, false);



function createShareUrl() {
    /* createShareUrl()
     * - Creates a share url when user clicks 'generate key' button &
     *   automatically sends this key to the signaling server.
     *   
    */
    
    //Generate a new key for the user
    var key = Seshi.setKey(); 

    //Build share url:
    var shareUrl = document.location.origin + '?key=' + key;
    console.log("Generated share url: \n" + shareUrl);
    
    //send this key to signaling server
    connectToSignalServer();
    
    //Update UI: Replace the generate key button s message telling user 
    //what to do next:
    replaceGenerateKeyBtn();

}//End createShareUrl()


function connectToSignalServer() {
    /* Send key to signal server to create signaling channel
     * 
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
     connect(); //Defined in Seshi.js (TODO attach this to seshi api)
}//End connectToSignalServer()


function replaceGenerateKeyBtn() {
    /* Replaces the generate key button with a 'connecting' message
     * Note, this function presumes that the key has already been
     * sent to the signaling server (connectToSignalServer()).
     */

    //Get reference to Generate Key button
    generateKeyBtn = document.getElementById('setKey');

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var connectBtn = document.createElement('button');
    connectBtn.id = 'connect';
    connectBtn.className = 'button button--antiman button--round-l button--text-medium btn-generate-key';
    connectBTnText = document.createTextNode("Send your friend the key ->"); //Message shown to user on button
    connectBtn.appendChild(connectBTnText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectBtn, generateKeyBtn); //Replace the old button with the new
}//replaceGenerateKeyBtn()


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


/* Show 'connecting' instead of generate key box if 'key' is in URI */
if (getQueryVariable("key")) {
    //Get reference to Generate Key button
    generateKeyBtn = document.getElementById('setKey');

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var waitingBtn= document.createElement('button');
    waitingBtn.id = 'connect';
    waitingBtn.className = 'button button--antiman button--round-l button--text-medium btn-generate-key';
    waitingBTnText = document.createTextNode("Connecting..."); //Message shown to user on button
    waitingBtn.appendChild(waitingBTnText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(waitingBtn, generateKeyBtn); //Replace the old button with the new

}//End show 'connecting' instead of generate key box if 'key' is in URI */

displayFiles();
