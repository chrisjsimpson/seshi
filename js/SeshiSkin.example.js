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

//Event: When user clicks any of the share buttons, generatee a share URL 
shareBtns = document.getElementsByClassName('icon-link');
//Attach createShareUrl event listener to each share url button
for(var i=0;i<shareBtns.length;i++)
{
       shareBtns[i].addEventListener('click', createShareUrl, false);
}//End attach createShareUrl event listener to each share url button


//Event: When we have a true Peer-to-Peer data connection established:
window.addEventListener('peerConnectionEstablished', showConnected, false);

//Event: Recieved file listing of connected peer
window.addEventListener('gotRemoteFileList', function(){updateFileListDisplay(Seshi.remoteFileList, 'remoteFileList');}, false); 

//Event: Storage worker has stored more chunks of a file(s)
window.addEventListener('storeFilesProgressUpdate', updateStoreProgressDisplay, false);

function createShareUrl() {
    /* createShareUrl()
     * - Creates a share url when user clicks 'generate key' button &
     *   automatically sends this key to the signaling server.
     *   
    */
    
    //Generate a new key for the user
    var key = Seshi.setKey(); 

    //Build share url:
    console.log("Generated share url: \n" + Seshi.getShareUrl());
    
    //send this key to signaling server
    connectToSignalServer();
    
    //Update UI: Replace the generate key button s message telling user 
    //what to do next:
    replaceGenerateKeyBtn();

    //Update Whatsapp share button
    updateWhatsAppShareBtn();

    //Clipboard
    var copyIcon = document.getElementsByClassName('fa-clipboard')
    //Set data-shareurl
    copyIcon[0].dataset.shareurl = Seshi.getShareUrl();
    new Clipboard('.fa-clipboard', {
        text: function(trigger) {
            return trigger.getAttribute('data-shareurl');
        }
    });

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
    generateKeyBtn = document.getElementById('connectionStatus');

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var connectBtn = document.createElement('p');
    connectBtn.id = 'connectionStatus';
    connectBtn.className = '' ;
    connectBTnText = document.createTextNode("Send your friend the key:\n " + Seshi.getShareUrl()); //Message shown to user on button
    connectBtn.appendChild(connectBTnText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectBtn, generateKeyBtn); //Replace the old button with the new
}//replaceGenerateKeyBtn()


function updateWhatsAppShareBtn() {
    var whatsAppShareBtn = document.getElementsByClassName('whatsapp');
    //Update href with share url
    whatsAppShareBtn[0].href = 'whatsapp://send?text=' + Seshi.getShareUrl();
}//End updateWhatsAppShareBtn

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
    Seshi.play(fileId, "myVideo");
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
    var fileTable = document.getElementById('localFileList');
        fileTable.innerHTML = 'Refreshing file list.. <br /><img src="/img/Ajax-loader.gif" />';
    
    // Seshi..updateLocalFilesList() returns a promise, therefore we must 'wait' for it to resolve.
    Seshi.updateLocalFilesList().then( // .then() we know the .localFileList cache is updated, so we display the fresh list.
            function(complete){
                updateFileListDisplay(Seshi.localFileList(), 'localFileList');   
            });

}

function storeFile(fileList){
    Seshi.store({'dataSource':'fileSystem','data':fileList});
}

function deleteFile(event){
        fileId = event.target.dataset.id;
        Seshi.deleteFile(fileId);
        refreshFileList();
}


/* Show 'connecting' instead of generate key box if 'key' is in URI */
if (getQueryVariable("key")) {
    //Get reference to Generate Key button
    generateKeyBtn = document.getElementById('connectionStatus');

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var waitingBtn= document.createElement('button');
    waitingBtn.id = 'connectionStatus';
    waitingBtn.className = 'button button--antiman button--round-l button--text-medium btn-generate-key';
    waitingBTnText = document.createTextNode("Connecting..."); //Message shown to user on button
    waitingBtn.appendChild(waitingBTnText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(waitingBtn, generateKeyBtn); //Replace the old button with the new

}//End show 'connecting' instead of generate key box if 'key' is in URI */


function showConnected() {
    //Get reference to 'connecting' UI button
    if (targetBtn = document.getElementById('connectionStatus')) {
        
    } else {
        targetBtn = document.getElementById('connect');
    }

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var connectedBtn= document.createElement('p');
    connectedBtn.id = 'connectionStatus';
    connectedBtn.className = '';
    connectedBtnText = document.createTextNode("Connected!"); //Message shown to user on button
    connectedBtn.appendChild(connectedBtnText);

    var parentDiv = targetBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectedBtn, targetBtn); //Replace the old button with the new

    //Enable Send / Recieve buttons:
    var receiveBtn = document.getElementById('receiveBtn').disabled = false;
    var sendBtn = document.getElementById('sendBtn').disabled = false;

}//End showConnected





function getFileTypeIcon(mimeType) {

    switch(mimeType) {
        case 'audio/mp3':
        case 'audio/ogg':
             return 'fa-music';
        case 'video/mp4':
             return 'fa-film';
        case 'image/jpeg':
             return 'fa-picture-o';
        case 'application/pdf':
             return 'fa-file-pdf-o';
        default:
             return mimeType;
    }

}//End getFileTypeIcon(mimeType)



/* Update local files list UI */
function updateFileListDisplay(fileListObj, targetElm) {
    var files = fileListObj;
    var fileListHeaderId = 'localFilesBoxHeader';

    console.log("There are " + files.length + " local files");

    var list = '<div class="list-group-item row header-title" id="' + fileListHeaderId + '" >' +
                               '<input class="col-xs-1 col-sm-1 checkall" type="checkbox">' +
                                '<div class="col-xs-6 col-sm-6 table-border">File Name</div>' +
                                '<div class="col-xs-3 col-sm-2 ">Type</div>' +
                                '<div class="col-xs-2 col-sm-2"></div>' +
                                '<div class="col-xs-1 col-sm-1 dropdown">' +
                                    '<a href="#" class="dropdown-toggle" data-toggle="dropdown">' +
                                    '<i class="fa fa-chevron-down"></i>' +
                                    '</a>' +
                                    '<ul class="dropdown-menu">' +
                                        '<li><a href="#">Download </a></li>' +
                                        '<li class="divider"></li>' +
                                        '<li><a href="#">Delete</a></li>' +
                                    '</ul>' +
                                '</div>' +
                            '</div>';
    //Loop through each
    for(var i=0;i<files.length;i++) {

        var fileId = files[i].fileId;
        var fileName = files[i].fileName;
        var mimeType = files[i].fileType;

        //Open <li>
        list += '<li class="list-group-item file-item row">\n';
        //Checkbox
        list += '<input class="col-xs-1" type="checkbox" id="' + fileId + '">\n';
        //Checkbox label & file name
        list += '<label class="col-xs-6 table-border name-label" for="' + fileId + '">' + fileName + '</label>\n';
        //Filetype
        list += '<label class="col-xs-2 name-label" for="' + fileId + '"><i class="fa ' + getFileTypeIcon(mimeType) + '"></i></label>';
        //Play button
        list += '<div class="col-xs-1 "><a href="#overlay" title="Play"><i onclick="play(event)" data-id="' + fileId + '" class="fa fa-play"></i></a></div>';
        //Download button
        list += '<div class="col-xs-1 "><i onclick="download(event)" title="Download" data-id="' + fileId + '" class="fa fa-arrow-down"></i></div>';
        //Delete button
        if (targetElm != 'remoteFileList' ) 
        {
            list += '<div class="col-xs-1 hidden-xs"><i title="Delete" onclick="deleteFile(event)" data-id="' + fileId + '" class="fa fa-trash  "></i></div>';
        }//End if targetElm != 'remoteFileList'

        //Close </li>
        list += '</li>';
    }//End loop through each local file list (cached) and build list items
    //Update display with local files list
    var localFileList = document.getElementById(targetElm);//Get reference to local file list
    var numFilesInList = localFileList.children.length;
    
    for(var i=1; i < numFilesInList; i++) //Remove all current items from local file list
    {  //Note that we start at index 1, so as not to delete the table header. 
       localFileList.removeChild(localFileList.children[1]);
    }//End remove all current items in list ready for replacement

    //Update table with local file list:
    localFileList.innerHTML = list;
}//updateLocalFileListDisplay()


updateFileListDisplay(Seshi.localFileList(), 'localFileList');



function updateStoreProgressDisplay() {

    //Loop through each item in Seshi.storeProgress & update the display accordingly
    for ( var fileId in Seshi.storeProgress) {
        console.log("key: " + fileId);
        Seshi.storeProgress[fileId];
        var fileName = Seshi.storeProgress[fileId].fileName;
        var valueNow = parseInt(Seshi.storeProgress[fileId].currentChunk / (Seshi.storeProgress[fileId].totalNumChunks / 100));

        //Delete progress bar if reached 100%
        if ( valueNow >= 100 ) {
                document.getElementById('storingFileId-' + fileId).remove();
                refreshFileList();
        }//End Delete progress bar if reached 100%

        var output = '' +
                '<li class="list-group-item file-item uploading-item row" id="storingFileId-' + fileId + '">' +
                    //Filename  
                '   <div class="col-xs-4 col-sm-3">' + fileName + '</div> ' +
                    //Progress bar
                '   <div class="col-xs-5  col-sm-6">' +
                '       <div class="uploading active" role="progressbar" aria-valuenow="' + valueNow + '" aria-valuemin="0" aria-valuemax="100" style="width: 100%">' +
                '            <span class="uploadbar" style="width: ' + valueNow + '%;"></span>' + 
                '                </div>' +
                '   </div>' +
                    //Percentage complete
                '   <div class="col-xs-1 col-sm-1">' +
                '       <div id="percentupload">' + valueNow + '%</div>' +
                '        </div>' +
                    //Cancell button
                '   <div class="col-xs-1 col-sm-1">' +
                '       <i class="fa fa-times "></i>' +
                '   </div>'
                '       <div class="col-xs-1 col-sm-1"></div>' +
                '</li>';
        //Delete existing progress bar if already present:
        if ( rmProgressBar = document.getElementById('storingFileId-' + fileId)) 
        {
             rmProgressBar.remove();
        }//End Delete existing progress bar if already present
         
        var localFileListBox = document.getElementById('localFilesBoxHeader'); //LocalfileList header
        localFileListBox.insertAdjacentHTML('afterend', output);
    }//End loop through each item in Seshi.storeProgress & update the display accordingly
}//End updateStoreProgressDisplay()
