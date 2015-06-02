document.addEventListener("DOMContentLoaded", function() {

var api = new API();
var currentUser;

document.getElementById('newUser').addEventListener('click', function(e) {
  var username = document.getElementById('newUsername').value;
  var password = document.getElementById('newPassword').value;
  api.userExists(username).then(function(exists){
    if(!exists){
      var result = {};
      currentUser = new User(username);
      document.getElementById('newUser').disabled = true;
      currentUser.generateMasterKey().then(function(){
        return currentUser.exportPrivateKey(password);
      }).then(function(privateKey){
        result.privateKey = privateKey;
        return currentUser.exportPublicKey();
      }).then(function(publicKey){
        result.publicKey = publicKey;
        return api.addUser(currentUser.username, result.privateKey, result.publicKey);
      }).then(function(msg){
        document.getElementById('newUser').disabled = false;
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('userTitle').textContent = currentUser.username;
        document.getElementById('secrets').style.display = '';
        document.getElementById('deco').style.display = '';
        setTimeout(function(){ getSecretList(currentUser); }, 1000);
      }, function(err){
        alert(err);
        throw(err);
      });
    }
    else{
      alert('Username already exists');
    }
  });
});

document.getElementById('getKeys').addEventListener('click', function(e){
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;
  var remoteUser;
  api.getUser(username).then(function(user){
    currentUser = new User(username);
    remoteUser = user;
    currentUser.keys = remoteUser.keys;
    return currentUser.importPublicKey(remoteUser.publicKey);
  }).then(function(){
    return currentUser.importPrivateKey(password, remoteUser.privateKey);
  }).then(function(){
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('userTitle').textContent = currentUser.username;
    document.getElementById('secrets').style.display = '';
    document.getElementById('deco').style.display = '';
    getSecretList(currentUser);
  }, function(err){
    alert(err);
    throw(err);
  });
});

document.getElementById('addSecret').addEventListener('click', function(e){
  var title   = document.getElementById('secretTitle').value;
  var content = document.getElementById('secretContent').value;
  currentUser.createSecret(title, content).then(function(secretObject){
    return api.addSecret(secretObject);
  }).then(function(msg){
    document.getElementById('secretTitle').value = '';
    document.getElementById('secretContent').value = '';
    return api.getKeys(currentUser.username);
  }).then(function(keys){
    currentUser.keys = keys;
    getSecretList(currentUser);
  }, function(err){
    alert(err);
    throw(err);
  });
});

var timeout;

window.addEventListener('focus', function() {
  clearInterval(timeout);
});

window.addEventListener('blur', function() {
  timeout = setTimeout(function() { destroyUser(currentUser); }, 30000);
});


document.getElementById('deco').addEventListener('click', function(e){
  destroyUser(currentUser);
});

function destroyUser(user){
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  document.getElementById('userTitle').textContent = 'Not connected';
  document.getElementById('secrets').style.display = 'none';
  document.getElementById('deco').style.display = 'none';
  user.disconnect();
}

function share(e){
  var hashedTitle  = e.path[1].children[0].textContent;
  var encryptedSecret;
  var friend;
  var rights;
  api.getSecret(hashedTitle).then(function(eSecret){
    encryptedSecret = eSecret;
    var friendName = prompt('Which friend ?');
    rights = prompt('Which rights (0=read, 1=+write, 2=+share) ?');
    friend = new User(friendName);
    e.target.disabled = true;
    return api.getPublicKey(friend.username);
  }).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(sharedSecretObject){
    return api.shareSecret(currentUser, sharedSecretObject, hashedTitle, rights);
  }).then(function(){
    e.target.disabled = false;
  }, function(err){
    e.target.disabled = false;
    alert(err);
    throw(err);
  });
}

function unHide(e){
  var hashedTitle  = e.path[1].children[0].textContent;
  var input = e.path[1].children[2];
  var btn   = e.target;
  var btnEdit   = e.path[1].children[4];
  if(btn.value === 'Unhide'){
    api.getSecret(hashedTitle).then(function(encryptedSecret){
      return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
    }).then(function(secret){
      input.type  = 'text';
      input.value = secret;
      btn.value   = 'Hide';
    });
  }
  else{
    input.disabled = true;
    input.type  = 'password';
    input.value = '********';
    btn.value   = 'Unhide';
    btnEdit.value = 'Edit';
  }
}

function editSecret(e){
  var hashedTitle       = e.path[1].children[0].textContent;
  var input             = e.path[1].children[2];
  var btn               = e.path[1].children[3];
  var btnEdit           = e.target;
  if(btn.value === 'Unhide'){
    api.getSecret(hashedTitle).then(function(encryptedSecret){
      return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
    }).then(function(secret){
      input.type  = 'text';
      input.value = secret;
      btn.value   = 'Hide';
    });
  }

  if(btnEdit.value === 'Edit'){
    input.disabled = false;
    btnEdit.value = 'Save';
  }
  else{
    var content = input.value;
    currentUser.editSecret(content, currentUser.keys[hashedTitle].key).then(function(secretObject){
      return api.editSecret(currentUser, secretObject, hashedTitle);
    }).then(function(){
      btnEdit.value = 'Edit';
      input.disabled = true;
    }, function(err){
      alert(err);
      throw(err);
    });
  }
}

function deleteSecret(e){
  var title       = e.path[1].children[1].textContent;
  var hashedTitle = e.path[1].children[0].textContent;
  var sure = confirm('Are you sure to delete ' + title + '?');
  if(sure){
    api.deleteSecret(currentUser, hashedTitle).then(function(){
      return api.getKeys(currentUser.username);
    }).then(function(keys){
      currentUser.keys = keys;
      getSecretList(currentUser);
    }, function(err){
      alert(err);
      throw(err);
    });
  }
}

function uiSecret(hashedTitle, title){
  var elem = document.createElement('li');
  elem.classList.add('secretElem');
  var secret = document.createElement('input');
  secret.type = 'password';
  secret.value = '********';
  secret.disabled = true;

  var btn = document.createElement('input');
  btn.type = 'button';
  btn.value = 'Unhide';
  btn.addEventListener('click', unHide);

  var shareBtn = document.createElement('input');
  shareBtn.type = 'button';
  shareBtn.value = 'Share';
  shareBtn.addEventListener('click', share);

  var editBtn = document.createElement('input');
  editBtn.type = 'button';
  editBtn.value = 'Edit';
  editBtn.addEventListener('click', editSecret);

  var deleteBtn = document.createElement('input');
  deleteBtn.type = 'button';
  deleteBtn.value = 'Delete';
  deleteBtn.addEventListener('click', deleteSecret);

  var titleSpan = document.createElement('span');
  titleSpan.textContent = title.substring(14);

  var hashSpan = document.createElement('span');
  hashSpan.textContent = hashedTitle;
  hashSpan.style.display = 'none';
  elem.appendChild(hashSpan);
  elem.appendChild(titleSpan);
  elem.appendChild(secret);
  elem.appendChild(btn);
  elem.appendChild(editBtn);
  elem.appendChild(shareBtn);
  elem.appendChild(deleteBtn);
  return elem;
}

function getSecretList(){
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  currentUser.decryptTitles().then(function(){
    Object.keys(currentUser.titles).forEach(function(hashedTitle){
      secretsList.appendChild(uiSecret(hashedTitle, currentUser.titles[hashedTitle]));
    });
  });
}
