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
                                ' onclick="Seshi.play(' + fileList[i].fileId + '">' + fileList[i].fileName + '</td>\n' +
                                '<td data-col="actions"> Play / Download / Share</td>\n' +
                           '</tr>\n\n';
        }

    tbodyEnd = '</tbody>';
    tableOutput = table + theader + tbodyStart + tbodyContent + tbodyEnd + '</table>';
    //Update filetable
    var fileTable = document.getElementById('fileTable');
    fileTable.innerHTML = tableOutput;
}//End displayFiles
