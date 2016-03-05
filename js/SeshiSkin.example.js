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

//Event: When user clicks copy keybutton, generatee a share URL
copyKeyBtn = document.getElementById('copyclipboard');
//Attach createShareUrl event listener to each share url button
copyKeyBtn.addEventListener('click', createShareUrl, false);



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

//Event: When user requests to 'Receive' (pull) a file to their device
var multiPullBtn = document.getElementById('receiveBtn');
multiPullBtn.addEventListener('click', pullSelectedFiles, false);

//Event: Chat- user sets their display name by hitting <enter> key
var displayNameInput = document.getElementById('display-name');
  // Set display name if already set
  displayNameInput.value = Seshi.getDisplayName();
displayNameInput.addEventListener('keydown', setDisplayName, false);//If user presses enter key
displayNameInput.addEventListener('blur', setDisplayName, false);//User leaves focus of input

//Event: Chat, when user clicks the send message button, send message
var sendMsg = document.getElementById('sendMsg');
sendMsg.addEventListener('click', function(){sendChat()});


//Event: When we have a true Peer-to-Peer data connection established:
window.addEventListener('onPeerConnectionEstablished', showConnected, false);

//Event: Peer-to-Peer data connection is BROKEN :'( :
window.addEventListener('onPeerConnectionBroken', peerConnectionBroken, false);

//Event: Recieved file listing of connected peer
window.addEventListener('gotRemoteFileList', function(){updateFileListDisplay(Seshi.remoteFileList, 'remoteFileList');}, false);

//Event: Storage worker has stored more chunks of a file(s)
window.addEventListener('storeFilesProgressUpdate', updateStoreProgressDisplay, false);

//Event: sendFileProgressUpdate recived
window.addEventListener('sendFileProgressUpdate', updateSendFileProgessDisplay, false);

//Event: displayName of remote user is recived
window.addEventListener('onGotRemoteDisplayName', showRemoteDisplayName, false);



function tickAllFiles(list) {

    //Work out which file box we're playing with, based on 'list' <<- value of list is set by  event listner
    list == 'checkAll-remoteFileList' ? fileList = "remoteFileCheckBox" : fileList = "localFileCheckBox";

    //Get the value of the toggle check box
    var newState = document.getElementById(list).checked;

    //Set each file's checkbox to the value of the toggler
    var fileList = document.getElementsByClassName(fileList);
    for(var i=0; i< fileList.length; i++) {
                fileList[i].checked = newState;
    }//End loop though local files list ticking each file
}//End checkAll local files

function peerConnectionBroken() {
    /* Called by event listener when sendFileProgressUpdate event is fired
     *  Used to display a break in Datachannel connection.
     * */
    alert("Doh we broke the internet!");
    alert("Hold on, we'll try and reconnect");
    var connectionStateBox = document.getElementById('connectionStatus');
    connectionStateBox.innerText = 'Atempting Reconnect...';
    connect();

    //Disable Send / Recieve buttons:
    var receiveBtn = document.getElementById('receiveBtn').disabled = true;
    var sendBtn = document.getElementById('sendBtn').disabled = true;

    //Disable chat button / Show online status
    var chatToggleBtn = document.getElementById('chatToggle');
    chatToggleBtn.innerText  = "CHAT: Offline"
    //End show show tollge button status

}//End peerConnectionBroken()


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
                var mimeType = objectInfo.mimeType;
                //Detemine mimetype & show media player accordingly
                // switch(mimeType) {
                //
                //
                // }//End detemine mimetype & show media player accordingly
                if (objectInfo.mimeType.includes('audio'))
                {
                        $('.plyr').show()
                        mediaType = 'audio';
                        $("#hideall").css('position', 'relative');
                        $('.plyr').css({
                            'position': 'fixed',
                            'bottom': '0',
                            'width': '100%',
                            'z-index':'1001'
                                });
                            $('.btn-hide').hide();
                } else if (objectInfo.mimeType.includes('video')) {
                        mediaType = 'video';
                          $('.plyr').show();
                        if ($(window).width() > 992) {
                          $('.plyr').css({
                              'position': 'relative',
                              'width': '100%',
                              'z-index':'1'
                                  });
                          $("#hideall").css('position', 'absolute');
                          $("#hideall").hide();
                            $('.btn-hide').show();
                        } else if ($(window).width() < 992 && $(window).width() > 768 ) {
                          $('.plyr').css({
                              'position': 'fixed',
                              'bottom': '0',
                              'width': '62%',
                              'z-index':'1001'
                                  });
                          $("#hideall").css('position', 'relative');
                            $("#hideall").show();
                            $('.btn-hide').hide();
                        }  else if ($(window).width() < 768 && $(window).width() > 480) {
                          $('.plyr').css({
                              'position': 'fixed',
                              'bottom': '0',
                              'width': '72%',
                              'z-index':'1001'
                                  });
                            $("#hideall").show();
                            $('.btn-hide').hide();
                          }   else if ($(window).width() < 480) {
                            $('.plyr').css({
                                'position': 'fixed',
                                'bottom': '0',
                                'width': '100%',
                                'z-index':'1001'
                                    });
                            $("#hideall").show();
                            $('.btn-hide').hide();
                            }
                } else {
                          $('.plyr').show();
                        mediaType = 'audio';
                        //Default to audio (why? becuse we don't want a big black video screen unesseserily)

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

function refreshFileList(listId) {
    //Show loading throbber css animation whilst refreshing file list
 
    var throbberId = 'throbber-' + listId;
    var throbber = '<div id="' + throbberId + '" class="ball-pulse">' +
                    '<div></div>' +
                    '<div></div>' +
                    '<div></div>' +
                    '</div>';

    document.getElementById('header-' + listId).insertAdjacentHTML('afterend', throbber);

    // Seshi..updateLocalFilesList() returns a promise, therefore we must 'wait' for it to resolve.
    Seshi.updateLocalFilesList().then( // .then() we know the .localFileList cache is updated, so we display the fresh list.
            function(complete){
                //Remove throbber
                document.getElementById(throbberId).remove();
                updateFileListDisplay(Seshi.localFileList(), listId);
                //If peer connection is established, resend new local file list to peer
                if(Seshi.connectionStatus.dataChannelState() == 'open')
                {
                    Seshi.sendLocalFileListToRemote();
                }//End if peer connection is established, resend new local file list to peer.
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
        refreshFileList('localFileList');
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

    //Enable chat button / Show online status
    var chatToggleBtn = document.getElementById('chatToggle');
    chatToggleBtn.innerText  = "CHAT: Connected!"
    //End show show tollge button status

}//End showConnected





function getFileTypeIcon(mimeType) {

    switch(mimeType) {
        case 'audio/mp3':
        case 'audio/ogg':
             return 'fa-music';
        case 'video/mp4':
        case 'video/ogg':
        case 'video/3gpp':
        case 'video/x-msvideo':
        case 'video/x-flv':
             return 'fa-film';
        case 'image/jpeg':
        case 'image/png':
        case 'image/svg+xml':
             return 'fa-file-image-o';
        case 'application/pdf':
             return 'fa-file-pdf-o';
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
              return 'fa-file-word-o';
        case 'text/html':
        case 'text/css':
              return 'fa-file-code-o';
        case 'text/csv':
        case 'text/plain':
        case 'application/x-latex':
        case 'application/x-tex':
              return 'fa-file-text-o';
        default:
             return mimeType;
    }

}//End getFileTypeIcon(mimeType)


/* Update files list UI */
function updateFileListDisplay(fileListObj, targetElm) {
    var files = fileListObj;
    var list = '';

    //Determine checkAll id
    switch(targetElm) {
        case 'localFileList':
            checkAllId =  'checkAll-localFileList';
            break;
        case 'remoteFileList':
            checkAllId = 'checkAll-remoteFileList';
            break;
    }//End determine checkall id

    console.log("There are " + files.length + " " + targetElm + " files");

    //Loop through each
    for(var i=0;i<files.length;i++) {

        var fileId = files[i].fileId;
        var fileName = files[i].fileName;
        var mimeType = files[i].fileType;
        var checkBoxClass = targetElm == 'localFileList' ? 'localFileCheckBox' : 'remoteFileCheckBox';

        //Open <li>
        list += '<li class="list-group-item file-item row">\n';
        //Checkbox
        list += '<input class="col-xs-1 ' + checkBoxClass + '" type="checkbox" id="' + fileId + '" data-id="' + fileId + '">\n';
        //Checkbox label & file name
        list += '<label class="col-xs-6 table-border name-label" for="' + fileId + '">' + fileName + '</label>\n';
        //Filetype
        list += '<label class="col-xs-2 name-label" for="' + fileId + '"><i class="fa ' + getFileTypeIcon(mimeType) + '"></i></label>';
        if (targetElm != 'remoteFileList' ) //Only show action buttons (delete, play, download) on the local file list side)
        {
            //Delete button
            list += '<div class="col-xs-1 hidden-xs"><i title="Delete" onclick="deleteFile(event)" data-id="' + fileId + '" class="fa fa-trash  "></i></div>';
            //Play button
                //Only show play button if file is playable
                if(Seshi.isPlayable(mimeType, fileName))
                {
                    list += '<div class="col-xs-1 "><a title="Play"><i onclick="play(event)" data-id="' + fileId + '" class="fa fa-play"></i></a></div>';
                }else {
                    list += '<div class="col-xs-1 "></div>';
                }//End only show play button if file is playable
            //Download button
            list += '<div class="col-xs-1 "><i onclick="download(event)" title="Download" data-id="' + fileId + '" class="fa fa-arrow-down"></i></div>';
        }//End if targetElm != 'remoteFileList'

        //Close </li>
        list += '</li>';
    }//End loop through each local file list (cached) and build list items
    //Update display with local files list
    var fileBoxList = document.getElementById(targetElm);//Get reference to file box 
    var numFilesInList = fileBoxList.children.length;

    for(var i=1; i < numFilesInList; i++) //Remove all current items from local file list
    {  
       fileBoxList.removeChild(fileBoxList.children[0]);
    }//End remove all current items in list ready for replacement

    //Update table with file list:
    fileBoxList.innerHTML = list;

}//updateFileListDisplay()


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
                    '   <div class="col-xs-4 col-sm-4">' + fileName + '</div> ' +
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
                    '   </div>' +
                    '</li>';

             //If complete, check for existing progress bar and delete it
             if (valueNow >= 100) {
                    refreshFileList('localFileList');
             }//If valueNow >= 100 refresh locaFileList
             //If not, replace any existing progress bar to the list
             if(complete) {//TODO remove this
                    if (document.getElementById('storingFileId-' + fileId)) {
                        document.getElementById('storingFileId-' + fileId).remove();
                    }
                    //Set UI complete flag
                    Seshi.storeProgress[fileId].UIdone = true;
                    refreshFileList('localFileList');
             } else { //End if complete
                    //If not complete:
                    if (document.getElementById('storingFileId-' + fileId)) {
                        document.getElementById('storingFileId-' + fileId).remove();
                    }
                    document.getElementById('header-localFileList').insertAdjacentHTML('afterend', output);
             }//End if not complete
         }//End check Seshi.storeProgress[fileId].UIdone == false before proceeding (prevents itterating over already completed UI updates.
    }//End loop through each item in Seshi.storeProgress & update the display accordingly
}//End updateStoreProgressDisplay()


function sendSelectedFiles() {

    //Get list of files user has selected for sending
    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    //Only send if datachannel is open!
    if (Seshi.connectionStatus.iceConnectionState() == "connected" || Seshi.connectionStatus.iceConnectionState() == 'completed')
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
    refreshFileList('localFileList');
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



function pullSelectedFiles() {
    var remoteFileCheckBoxes = document.getElementsByClassName('remoteFileCheckBox');
    var requestedFiles = [];
    for(var i=0; i< remoteFileCheckBoxes.length; i++) {
        //Check file is selected before collecting
        if (remoteFileCheckBoxes[i].checked == true)
        {
            requestedFiles.push(
                    {
                        fileId: remoteFileCheckBoxes[i].dataset.id,
                        requestType:'ALL'
                    });
        }//Only collect files wanting to be pulled
    }//End loop though remote files list checking for selected files the user wants

    //Send pull request if not empty:
    if(requestedFiles.length > 0)
    {
        Seshi.requestFilesFromPeer(requestedFiles);
    }//End send pull request to peer

}//End pullSelectedFiles()

function updateSendFileProgessDisplay() {
//Called upon sendFileProgressUpdate event being fired
    console.log(Seshi.sendingFileProgress);
        var fileId = Seshi.sendingFileProgress.fileId;
        var fileName = Seshi.sendingFileProgress.fileName;
        var fileType = Seshi.sendingFileProgress.fileType;
        var chunkNumber = Seshi.sendingFileProgress.chunkNumber;
        var numberOfChunks = Seshi.sendingFileProgress.numberOfChunks;
        var valueNow = parseInt((chunkNumber + 1) / numberOfChunks * 100);
        var complete = Seshi.sendingFileProgress.allFileDataSent;

    var output = '' +
            '<li class="list-group-item file-item uploading-item row" id="sendingFileId-' + fileId + '">' +
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
     if (valueNow >= 100) {
         //Set UI complete flag
         Seshi.sendingFileProgress.UIdone = true;
         //Remove completed 'sending file' progress bar from senders UI
            if (document.getElementById('sendingFileId-' + fileId)) {
                document.getElementById('sendingFileId-' + fileId).remove();
            }
     } else { //End if complete
            //If not complete:
            if (document.getElementById('sendingFileId-' + fileId)) {
                document.getElementById('sendingFileId-' + fileId).remove();
            }
            document.getElementById('header-remoteFileList').insertAdjacentHTML('afterend', output);
     }//End if not complete
}//End updateSendFileProgessDisplay()



function setDisplayName(e) {
    if(e.keyCode == 13 || e.type == 'blur') {
        var displayName = document.getElementById('display-name').value;
        Seshi.setDisplayName(displayName);
    }//End if enter key pressed, set display name
}//End setDisplayName()



function showRemoteDisplayName() {
    /* Called automatically when onGotRemoteDisplayName event is fired
     *
     * Updated UI with the 'Chatting to <user/device> message
    *
    */
    //Get reference to connected peers display name (remote peer)
    var displayNameBox = document.getElementById('remoteDisplayName');
    //Update value with the remote's display name (which could be anything...)
    displayNameBox.innerHTML = Seshi.getRemoteDisplayName();

}//End showRemoteDisplayName()





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

//Event: User clicks 'check all' button on a files list
var localCheckAll = document.getElementById('checkAll-localFileList');
localCheckAll.addEventListener('click', function(){ tickAllFiles('checkAll-localFileList');}, false);

var remoteCheckAll = document.getElementById('checkAll-remoteFileList');
remoteCheckAll.addEventListener('click', function(){ tickAllFiles('checkAll-remoteFileList');}, false);
