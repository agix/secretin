  var fs = require('fs');
  var currentUser = {};
  try{
    var dbObject = JSON.parse(fs.readFileSync(dbPath));
  }
  catch (e) {
    var dbObject = {"users":{}, "secrets": {}};
  }

  var api = new API(dbObject);
});