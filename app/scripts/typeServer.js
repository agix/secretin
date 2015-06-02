document.getElementById('dbUri').addEventListener('change', function(e) {
  var db = e.target.value;
  api = new API(db);
});

document.getElementById('remote').style.display = '';
document.getElementById('getDb').style.display = '';
document.getElementById('db').disabled = true;


document.getElementById('getDb').addEventListener('click', function(e) {
  if(typeof currentUser !== 'undefined' && typeof currentUser.username !== 'undefined'){
    api.getDb(currentUser.username).then(function(db){
      document.getElementById('db').value = JSON.stringify(db);
    });
  }
  else{
    document.getElementById('db').value = 'Not connected !';
    setTimeout(function(){ document.getElementById('db').value = ''; }, 1000);
  }
});

});