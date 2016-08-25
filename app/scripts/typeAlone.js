var menu = document.getElementById('menu');
menu.children[0].classList.remove('hover');
menu.children[1].classList.add('hover');
document.getElementById('db').disabled = false;
document.getElementById('db').addEventListener('change', function(e) {
  try{
    var db = JSON.parse(e.target.value);
    secretin.changeDB(db);
  }
  catch (e){
    console.log('Invalid JSON : ' + e.message);
  }
});

var secretin = new Secretin();

});