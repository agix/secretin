document.getElementById('db').disabled = false;
document.getElementById('db').addEventListener('change', function(e) {
  try{
    var db = JSON.parse(e.target.value)
    api = new API(db, e.target);
  }
  catch (e){
    console.log('Invalid JSON : ' + e.message)
  }
});

});