document.getElementById('dbUri').addEventListener('change', function(e) {
  var db = e.target.value;
  api = new API(db);
});

document.getElementById('db').disabled = true;

var api = new API();
var currentUser = {};

});