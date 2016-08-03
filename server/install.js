var cradle = require('cradle');
var c = new(cradle.Connection)
var db = c.database('secretin')
db.create(function(err){
  console.log(err);
});

db.save('_design/users', {
      getUser: {
          map: function(doc) {
            if(doc.user){
              var key = Object.keys(doc.user)[0];
              emit(key, {res: doc.user[key], rev: doc._rev});
            }
          }
      }
});

db.save('_design/secrets', {
      getSecret: {
          map: function(doc) {
            if(doc.secret){
              var key = Object.keys(doc.secret)[0];
              emit(key, {res: doc.secret[key], rev: doc._rev});
            }
          }
      },
      getMetadatas: {
        map: function (doc) {
          if(doc.secret){
            var key = Object.keys(doc.secret)[0];
            var res = doc.secret[key].users;
            doc.secret[key].users.forEach(function(user){
              emit(user, {res: {title: key, iv_meta: doc.secret[key].iv_meta, metadatas: doc.secret[key].metadatas}, rev: doc._rev});
            });
          }
        }
      }
});