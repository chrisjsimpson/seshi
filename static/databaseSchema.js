//Make a new database conection
var db = new Dexie('seshi');

//Define a schema
db.version(1)
    .stores({
        chunks: '[fileId+chunkNumber],*fileId, boxId'
    });

//Open the database
db.open()
    .catch(function(error){
        alert('Oh oh : ' + error);
    })
