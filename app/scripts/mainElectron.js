document.addEventListener("DOMContentLoaded", function() {
var ipcRenderer = require('electron').ipcRenderer;

var dbPath = 'db.json';

document.getElementById('getKeys').addEventListener('click', function(e){
  var btn = e.target;
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;
  var remoteUser;
  var key;
  var hash;
  btn.disabled = true;
  btn.value = 'Please wait...';
  getKeys(username, password).then(function(){
    btn.disabled = false;
    btn.value = 'Get keys';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('userTitle').textContent = currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    setTimeout(function() { destroyUser(currentUser); currentUser = {}; }, 60000);
    getSecretList(currentUser);
  }, function(err){
    btn.disabled = false;
    btn.value = 'Get keys';
    error(document.getElementById('errorLogin'), err);
    throw(err);
  });
});

document.getElementById('password').addEventListener('keypress', function(e){
  if(e.keyCode === 13){
    document.getElementById('getKeys').click();
  }
});

document.getElementById('newPassword').addEventListener('keypress', function(e){
  if(e.keyCode === 13){
    document.getElementById('newUser').click();
  }
});

function error(elem, text){
  elem.textContent = 'Error: ' + text;
  elem.style.display = '';
  setTimeout(function(){ cleanError(elem); }, 3000);
}

function cleanError(elem){
  elem.textContent = '';
  elem.style.display = 'none';
}

function getSecretList(){
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  getAllMetadatas().then(function(){
    Object.keys(currentUser.metadatas).forEach(function(hashedTitle){
      secretsList.appendChild(uiSecret(hashedTitle, currentUser.metadatas[hashedTitle].title));
    });
  });
}


function specialInput(parent, secret, inputPosition){
  var input = document.createElement('input');
  input.type = 'password';
  input.value = secret.content;
  input.readOnly = true;
  input.style.width = '60%';

  var labelA = document.createElement('span');
  labelA.textContent = secret.label+' : ';

  var copyA = document.createElement('span');
  copyA.textContent = '❐';
  copyA.classList.add('iconList');
  copyA.title = 'Copy';
  copyA.addEventListener('click', function(e){
    var input = e.target.parentNode.childNodes[inputPosition];
    input.type = 'text';
    input.select();
    document.execCommand('copy');
    ipcRenderer.sendSync('changeClipboard', input.value);
    input.type = 'password';
  });

  parent.appendChild(labelA);
  parent.appendChild(input);
  parent.appendChild(copyA);

  if(inputPosition === 4){
    var generateA = document.createElement('span');
    generateA.textContent = '⎁';
    generateA.classList.add('iconList');
    generateA.title = 'Generate Password';
    generateA.addEventListener('click', function(e){
      var sure = confirm('Are you sure to generate a new password ?');
      if(sure){
        var hashedTitle = e.target.parentNode.childNodes[0].textContent;
        var input = e.target.parentNode.childNodes[4];
        var lastInput = e.target.parentNode.childNodes[11];

        var lastContent = input.value;
        var currentContent = generateRandomString(30);

        input.value = currentContent;
        lastInput.value = lastContent;
        editSecret(hashedTitle, JSON.stringify({"fields": [{"label": "Current", "content": currentContent, "type": "password"}, {"label": "Last", "content": lastContent, "type": "password"}]})).then(function(){
          saveDb();
        }, function(err){
          alert(err);
          throw(err);
        });
      }
    });

    parent.appendChild(generateA);
  }

  var viewA = document.createElement('span');
  viewA.textContent = '😑';
  viewA.classList.add('iconList');
  viewA.title = 'Unhide';
  viewA.addEventListener('click', function(e){
    var input = e.target.parentNode.childNodes[inputPosition];
    if(e.target.textContent === '😑'){
      input.type = 'text';
      e.target.textContent = '😐';
      e.target.title = 'Hide';
    }
    else{
      input.type = 'password';
      e.target.textContent = '😑';
      e.target.title = 'Unhide';
    }
  });

  parent.appendChild(viewA);
  parent.appendChild(document.createElement('br'));
  parent.appendChild(document.createElement('br'));
}

function uiSecret(hashedTitle, title){
  var elem = document.createElement('li');
  elem.classList.add('secretElem');

  var titleSpan = document.createElement('span');
  titleSpan.textContent = title.substring(14);

  var hashSpan = document.createElement('span');
  hashSpan.textContent = hashedTitle;
  hashSpan.style.display = 'none';

  elem.appendChild(hashSpan);
  elem.appendChild(titleSpan);
  elem.appendChild(document.createElement('br'));

  getSecret(hashedTitle).then(function(secretJson){
    var secret = JSON.parse(secretJson);

    specialInput(elem, secret.fields[0], 4);
    specialInput(elem, secret.fields[1], 11);
  });

  return elem;
}

document.getElementById('changePasswordBtn').addEventListener('click', function(e) {
  var btn = e.target;
  var password = document.getElementById('changePasswordInput').value;
  var pass = {};
  btn.disabled = true;
  btn.value = 'Please wait...';
  changePassword(password).then(function(msg){
    btn.disabled = false;
    btn.value = 'Change password';
    document.getElementById('changePasswordInput').value = '';
    document.location.href = '#keys';
  }, function(err){
    btn.disabled = false;
    btn.value = 'Change password';
    alert(err);
    throw(err);
  });
});

document.getElementById('newUser').addEventListener('click', function(e) {
  var btn = e.target;
  var username = document.getElementById('newUsername').value;
  var password = document.getElementById('newPassword').value;
  btn.disabled = true;
  btn.value = 'Please wait...';
  newUser(username, password).then(function(msg){
    document.location.href = '#keys';
    btn.disabled = false;
    btn.value = 'Generate';
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('userTitle').textContent = currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    document.getElementById('deco').style.display = '';
    return addSecret('Domain password', '{"fields": [{"label": "Current", "content": "", "type": "password"}, {"label": "Last", "content": "", "type": "password"}]}');
  }).then(function(){
    saveDb();
    getSecretList(currentUser);
  }, function(err){
    btn.disabled = false;
    btn.value = 'Generate';
    error(document.getElementById('errorNew'), err);
    throw(err);
  });
});

document.getElementById('deco').addEventListener('click', function(e){
  destroyUser(currentUser);
  currentUser = {};
});

function destroyUser(user){
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  document.getElementById('userTitle').textContent = 'Not connected';
  document.getElementById('secrets').style.display = 'none';
  document.getElementById('login').style.display = '';
  user.disconnect();
}

function saveDb(){
  var fs = require('fs');
  api.getDb(currentUser.username, currentUser.hash).then(function(db){
    var content = JSON.stringify(db);
    fs.writeFileSync(dbPath, content);
  });
}

