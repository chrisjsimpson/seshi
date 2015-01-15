//Make a new database conection
var db = new Dexie('flytipper');

//Define a schema
db.version(1)
    .stores({
        chunks: '++id, fileId, boxId'
    });

//Open the database
db.open()
    .catch(function(error){
        alert('Oh oh : ' + error);
    })
