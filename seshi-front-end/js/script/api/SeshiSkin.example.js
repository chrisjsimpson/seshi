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
    smoothScroll('player');
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

function storeFile(fileList){
    Seshi.store({'dataSource':'fileSystem','data':fileList});
}

function deleteFile(event){
        fileId = event.target.dataset.id;
        alert("Deleting file...(refresh file list)");
        Seshi.deleteFile(fileId);
        Seshi.updateLocalFilesList();
}

function generateKey(keyBox) {
    var key = Seshi.generateKey();
    document.getElementById(keyBox).value = key;
}


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

displayFiles();
