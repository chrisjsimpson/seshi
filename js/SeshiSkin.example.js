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


//Event: When user clicks 'send' button, check which files are marked,
//send them over the datachannel
var sendBtn = document.getElementById('sendBtn');
sendBtn.addEventListener('click', sendSelectedFiles, false);

//Event: When user uses drop down menu to delete selected (checkbox items)
var multiDeleteBtn = document.getElementById('multiDeleteLocalFiles');
multiDeleteBtn.addEventListener('click', deleteSelectedFiles, false);

//Event: When user uses drop down menu to dowload selected local files (checkboxes)
var multiDownloadBtn = document.getElementById('multiDownloadLocalFiles');
multiDownloadBtn.addEventListener('click', function(){ downloadSelectedFiles(); }, false);

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


function play(event) {
    console.log("My player implimentation...");
    fileId = event.target.dataset.id;

    Seshi.generateObjectUrl(fileId).then(
            function(objectInfo){
                //Play using plyr
                //Settings:
                var options = {
                               'controls':["restart", "rewind", "play", "fast-forward", "current-time", "duration", "mute", "volume", "captions", "fullscreen"]
                                }
                var player = plyr.setup()[0]; //
                //Music or Audio?
                if (objectInfo.mimeType.includes('audio'))
                {
                        mediaType = 'audio';
                        $('#hideall').css('position', 'relative');
                        $('.plyr').css({
                            'position': 'fixed',
                            'bottom': '0',
                            'width': '100%',
                            'z-index':'1001'
                                });
                            $('.btn-hide').hide();
                } else if (objectInfo.mimeType.includes('video')) {
                        mediaType = 'video';
                        $('#hideall').css('position', 'absolute');
                        $('.plyr').css({
                            'position': 'relative',
                            'width': '100%',
                            'z-index':'1'
                                });
                            $('.btn-hide').show();

                } else {
                        mediaType = 'video';//Default to video (why?)
                }//End music or audio check

                player.source({
                                type:       mediaType,
                                title:      objectInfo.fileName,
                                sources: [{
                                    src: objectInfo.objectURL,
                                    type:     objectInfo.mimeType
                                }]});
                player.play(); //Play the chosen media
            });
}//End play()

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
    //Show loading throbber icon whilst refreshing file list
    var throbber = '<img src="/img/Ajax-loader.gif" />';
    document.getElementById('localFilesBoxHeader').insertAdjacentHTML('afterend', throbber);

    // Seshi..updateLocalFilesList() returns a promise, therefore we must 'wait' for it to resolve.
    Seshi.updateLocalFilesList().then( // .then() we know the .localFileList cache is updated, so we display the fresh list.
            function(complete){
                updateFileListDisplay(Seshi.localFileList(), 'localFileList');
            });
}//End refreshFileList()

function storeFile(fileList){
    Seshi.store({'dataSource':'fileSystem','data':fileList});
    //Scroll to file list so user can see storing progress bar indicator:
    smoothScroll('shareButtonsRow');
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

    console.log("There are " + files.length + " local files");

    //Loop through each
    for(var i=0;i<files.length;i++) {

        var fileId = files[i].fileId;
        var fileName = files[i].fileName;
        var mimeType = files[i].fileType;

        //Open <li>
        list += '<li class="list-group-item file-item row">\n';
        //Checkbox
        list += '<input class="col-xs-1 localFileCheckBox" type="checkbox" data-id="' + fileId + '">\n';
        //Checkbox label & file name
        list += '<label class="col-xs-6 table-border name-label" for="' + fileId + '">' + fileName + '</label>\n';
        //Filetype
        list += '<label class="col-xs-2 name-label" for="' + fileId + '"><i class="fa ' + getFileTypeIcon(mimeType) + '"></i></label>';
        //Play button
        list += '<div class="col-xs-1 "><a title="Play"><i onclick="play(event)" data-id="' + fileId + '" class="fa fa-play"></i></a></div>';
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
        if(Seshi.storeProgress[fileId].UIdone == false)
        {
            Seshi.storeProgress[fileId];
            var fileName = Seshi.storeProgress[fileId].fileName;
            var valueNow = parseInt((Seshi.storeProgress[fileId].currentChunk + 1) / Seshi.storeProgress[fileId].totalNumChunks * 100);
            var complete = Seshi.storeProgress[fileId].complete;

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

             //If complete, check for existing progress bar and delete it
             //If not, replace any existing progress bar to the list
             if(complete) {
                    if (document.getElementById('storingFileId-' + fileId)) {
                        document.getElementById('storingFileId-' + fileId).remove();
                    }
                    //Set UI complete flag
                    Seshi.storeProgress[fileId].UIdone = true;
                    refreshFileList();
             } else { //End if complete
                    //If not complete:
                    if (document.getElementById('storingFileId-' + fileId)) {
                        document.getElementById('storingFileId-' + fileId).remove();
                    }
                    document.getElementById('localFilesBoxHeader').insertAdjacentHTML('afterend', output);
             }//End if not complete
         }//End check Seshi.storeProgress[fileId].UIdone == false before proceeding (prevents itterating over already completed UI updates.
    }//End loop through each item in Seshi.storeProgress & update the display accordingly
}//End updateStoreProgressDisplay()





function sendSelectedFiles() {

    //Get list of files user has selected for sending
    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    //Only send if datachannel is open!
    if (Seshi.connectionStatus.iceConnectionState() == "connected")
    {
        for(var i=0; i< localFileCheckBoxes.length; i++) {
            if (localFileCheckBoxes[i].checked == true)
            {
                Seshi.sendFileToPeer(localFileCheckBoxes[i].dataset.id); //Send over dataChannel
            }//End only send if file's checkbox it checked.
        }//Loop though each localfile checkbox & send file over datachannel if checked

        //Unckeck all files after sending to prevent user resending same files accidentally
        for(var i=0; i< localFileCheckBoxes.length; i++) {
            localFileCheckBoxes[i].checked = false;
        }//End Unckeck all files after sending to prevent user resending same files accidentally
    }//End only send if datachannel is open
}//End sendSelectedFiles()


function deleteSelectedFiles() {

    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    for(var i=0; i< localFileCheckBoxes.length; i++) {
        //Check file is selected before deleting
        if (localFileCheckBoxes[i].checked == true)
        {
            Seshi.deleteFile(localFileCheckBoxes[i].dataset.id);
        }//End check file is selected before deleting
    }//Wns loop through all selected files, deleting them if selected
    refreshFileList();
}//End deleteSelectedFiles()

function downloadSelectedFiles() {
    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox'); 
    for(var i=0; i< localFileCheckBoxes.length; i++) {
        //Check file is selected before downloading
        if (localFileCheckBoxes[i].checked == true)
        {
            Seshi.download(localFileCheckBoxes[i].dataset.id);            
        }//Only downlod selected files
    }//End loop though local files list checking for selected files for download
}//End downloadSelectedFiles()

function smoothScroll(eID) {
    function currentYPosition() {
        // Firefox, Chrome, Opera, Safari
        if (self.pageYOffset) return self.pageYOffset;
        // Internet Explorer 6 - standards mode
        if (document.documentElement && document.documentElement.scrollTop)
            return document.documentElement.scrollTop;
        // Internet Explorer 6, 7 and 8
        if (document.body.scrollTop) return document.body.scrollTop;
        return 0;
    }

    function elmYPosition(eID) {
    var elm = document.getElementById(eID);
    var y = elm.offsetTop;
    var node = elm;
    while (node.offsetParent && node.offsetParent != document.body) {
        node = node.offsetParent;
        y += node.offsetTop;
    } return y;
    }
    var startY = currentYPosition();
    var stopY = elmYPosition(eID);
    var distance = stopY > startY ? stopY - startY : startY - stopY;
    if (distance < 100) {
        scrollTo(0, stopY); return;
    }
    var speed = Math.round(distance / 10);
    if (speed >= 20) speed = 20;
    var step = Math.round(distance / 25);
    var leapY = stopY > startY ? startY + step : startY - step;
    var timer = 0;
    if (stopY > startY) {
        for ( var i=startY; i<stopY; i+=step ) {
            setTimeout("window.scrollTo(0, "+leapY+")", timer * speed);
            leapY += step; if (leapY > stopY) leapY = stopY; timer++;
        } return;
    }
    for ( var i=startY; i>stopY; i-=step ) {
        setTimeout("window.scrollTo(0, "+leapY+")", timer * speed);
        leapY -= step; if (leapY < stopY) leapY = stopY; timer++;
    }
}
