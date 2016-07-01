document.addEventListener("DOMContentLoaded", function() {

document.getElementById('newUser').addEventListener('click', function(e) {
  var btn = e.target;
  var username = document.getElementById('newUsername').value;
  var password = document.getElementById('newPassword').value;
  api.userExists(username).then(function(exists){
    if(!exists){
      var result = {};
      var pass = {};
      currentUser = new User(username);
      btn.disabled = true;
      btn.value = 'Please wait...';
      currentUser.generateMasterKey().then(function(){
        return derivePassword(password);
      }).then(function(dKey){
        pass.salt = bytesToHexString(dKey.salt);
        pass.hash = bytesToHexString(dKey.hash);
        currentUser.hash = pass.hash;
        return currentUser.exportPrivateKey(dKey.key);
      }).then(function(privateKey){
        result.privateKey = privateKey;
        return currentUser.exportPublicKey();
      }).then(function(publicKey){
        result.publicKey = publicKey;
        return api.addUser(currentUser.username, result.privateKey, result.publicKey, pass);
      }).then(function(msg){
        document.location.href = '#keys';
        btn.disabled = false;
        btn.value = 'Generate';
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('userTitle').textContent = currentUser.username+'\'s secrets';
        document.getElementById('secrets').style.display = '';
        document.getElementById('login').style.display = 'none';
        document.getElementById('deco').style.display = '';
        setTimeout(function(){ getSecretList(currentUser); }, 1000);
      }, function(err){
        btn.disabled = false;
        btn.value = 'Generate';
        error(document.getElementById('errorNew'), err);
        throw(err);
      });
    }
    else{
      error(document.getElementById('errorNew'), 'Username already exists');
    }
  });
});

document.getElementById('getKeys').addEventListener('click', function(e){
  var btn = e.target;
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;
  var remoteUser;
  var key;
  var hash;
  btn.disabled = true;
  btn.value = 'Please wait...';
  api.getSalt(username).then(function(salt){
    return derivePassword(password, salt);
  }).then(function(dKey){
    key = dKey.key;
    hash = bytesToHexString(dKey.hash);
    return api.getUser(username, hash);
  }).then(function(user){
    currentUser = new User(username);
    remoteUser = user;
    currentUser.keys = remoteUser.keys;
    currentUser.hash = hash;
    return currentUser.importPublicKey(remoteUser.publicKey);
  }).then(function(){
    return currentUser.importPrivateKey(key, remoteUser.privateKey);
  }).then(function(){
    btn.disabled = false;
    btn.value = 'Get keys';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('userTitle').textContent = currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    document.getElementById('deco').style.display = '';
    getSecretList(currentUser);
  }, function(err){
    btn.disabled = false;
    btn.value = 'Get keys';
    error(document.getElementById('errorLogin'), err);
    throw(err);
  });
});

document.getElementById('addSecret').addEventListener('click', function(e){
  if(typeof(currentUser.username) === 'string'){
    var title   = document.getElementById('secretTitle').value;
    var content = document.getElementById('secretContent').value;
    currentUser.createSecret(title, content).then(function(secretObject){
      return api.addSecret(currentUser, secretObject);
    }).then(function(msg){
      document.getElementById('secretTitle').value = '';
      document.getElementById('secretContent').value = '';
      document.location.href = '#keys';
      return api.getKeys(currentUser.username, currentUser.hash);
    }).then(function(keys){
      currentUser.keys = keys;
      getSecretList(currentUser);
    }, function(err){
      alert(err);
      throw(err);
    });
  }
  else{
    document.location.hash = '#keys';
    error(document.getElementById('errorLogin'), 'You are disconnected');
  }

});

document.getElementById('changePasswordBtn').addEventListener('click', function(e) {
  var btn = e.target;
  var password = document.getElementById('changePasswordInput').value;
  var pass = {};
  btn.disabled = true;
  btn.value = 'Please wait...';
  derivePassword(password).then(function(dKey){
    pass.salt = bytesToHexString(dKey.salt);
    pass.hash = bytesToHexString(dKey.hash);
    return currentUser.exportPrivateKey(dKey.key);
  }).then(function(privateKey){
    return api.changePassword(currentUser, privateKey, pass);
  }).then(function(msg){
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

var timeout;

window.addEventListener('focus', function() {
  clearInterval(timeout);
});

window.addEventListener('blur', function() {
  timeout = setTimeout(function() { destroyUser(currentUser); currentUser = {}; }, 60000);
});

document.getElementById('deco').addEventListener('click', function(e){
  destroyUser(currentUser);
  currentUser = {};
});

document.getElementById('hideSecret').addEventListener('click', function(e){
  document.getElementById('showSecretTitle').textContent = '';
  document.getElementById('showSecretContent').value = '';
  document.location.href = '#keys';
});

document.getElementById('closeEditSecret').addEventListener('click', function(e){
  document.getElementById('editSecretTitle').textContent = '';
  document.getElementById('editSecretContent').value = '';
  document.getElementById('editSecretHash').value = '';
  document.location.href = '#keys';
});

document.getElementById('closeShareSecret').addEventListener('click', function(e){
  document.getElementById('shareSecretTitle').textContent = '';
  document.getElementById('shareSecretHash').value = '';
  var sharedUsersList = document.getElementById('sharedUsers');
  while (sharedUsersList.firstChild) {
    sharedUsersList.removeChild(sharedUsersList.firstChild);
  }
  document.location.href = '#keys';
});

document.getElementById('saveSecret').addEventListener('click', function(e){
  var hashedTitle = document.getElementById('editSecretHash').value;
  var content = document.getElementById('editSecretContent').value;
  currentUser.editSecret(content, currentUser.keys[hashedTitle].key).then(function(secretObject){
      return api.editSecret(currentUser, secretObject, hashedTitle);
  }).then(function(){
    alert('Secret saved');
  }, function(err){
    alert(err);
    throw(err);
  });
});

document.getElementById('share').addEventListener('click', function(e){
  var hashedTitle = document.getElementById('shareSecretHash').value;
  var encryptedSecret;
  var friend;
  var rights;
  api.getSecret(hashedTitle).then(function(eSecret){
    encryptedSecret = eSecret;
    var friendName = document.getElementById('friendName').value;
    rights = document.getElementById('rights').value;
    friend = new User(friendName);
    e.target.disabled = true;
    e.target.value = 'Please wait...';
    return api.getPublicKey(friend.username);
  }).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(sharedSecretObject){
    return api.shareSecret(currentUser, sharedSecretObject, hashedTitle, rights);
  }).then(function(){
    e.target.disabled = false;
    e.target.value = 'Share';
    document.getElementById('friendName').value='';
    var sharedUsersList = document.getElementById('sharedUsers');
    while (sharedUsersList.firstChild) {
      sharedUsersList.removeChild(sharedUsersList.firstChild);
    }
    share(false, hashedTitle, document.getElementById('shareSecretTitle').textContent);
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Share';
    document.getElementById('friendName').value='';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });
});

document.getElementById('refresh').addEventListener('click', function(e){
  document.getElementById('search').value = '';
  api.getKeys(currentUser.username, currentUser.hash).then(function(keys){
    currentUser.keys = keys;
    getSecretList(currentUser);
  }, function(err){
    alert(err);
    throw(err);
  });
});

document.getElementById('generatePwd').addEventListener('click', function(e){
  document.getElementById('secretContent').value = generateRandomString(30);
});

document.getElementById('editGeneratePwd').addEventListener('click', function(e){
  document.getElementById('editSecretContent').value = generateRandomString(30);
});

document.getElementById('copy').addEventListener('click', function(e){
  document.getElementById('showSecretContent').select();
  document.execCommand('copy');
  document.getElementById('search').select();
});

document.getElementById('changePasswordA').addEventListener('click', function(e){
  setTimeout(function(){ document.getElementById('changePasswordInput').focus(); }, 100);
});

document.getElementById('addSecretPopupA').addEventListener('click', function(e){
  setTimeout(function(){ document.getElementById('secretTitle').focus(); }, 100);
});

document.getElementById('search').addEventListener('keyup', function(e){
  var elems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < elems.length; i++) {
    if(e.target.value.length > 2 && elems[i].children[1].textContent.toLowerCase().indexOf(e.target.value.toLowerCase()) === -1){
      elems[i].style.display = 'none';
    }
    else{
      elems[i].style.display = '';
    }
  }
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

function destroyUser(user){
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  document.getElementById('userTitle').textContent = 'Not connected';
  document.getElementById('search').value = '';
  document.getElementById('secrets').style.display = 'none';
  document.getElementById('login').style.display = '';
  document.getElementById('deco').style.display = 'none';
  user.disconnect();
}

function unshare(e){
  var hashedTitle = document.getElementById('shareSecretHash').value;
  var unfriend;
  var friendName = e.path[1].children[0].textContent;
  var encryptedSecret;
  var secret = {};
  var wrappedKeys = [];
  var friend;
  e.target.disabled = true;
  e.target.value = 'Please wait...';
  api.unshareSecret(currentUser, friendName, hashedTitle, friendName).then(function(){
    return api.getSecret(hashedTitle);
  }).then(function(eSecret){
      encryptedSecret = eSecret;
      return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
      return currentUser.encryptSecret(secret);
  }).then(function(secretObject){
    secret.secret = bytesToHexString(secretObject.secret);
    secret.iv = bytesToHexString(secretObject.iv);
    encryptedSecret.users.forEach(function(hashedUsername){
      api.getPublicKey(hashedUsername, true).then(function(publicKey){
        friend = new User(hashedUsername);
        return friend.importPublicKey(publicKey);
      }).then(function(){
        return currentUser.wrapKey(secretObject.key, friend.publicKey);
      }).then(function(friendWrappedKey){
        wrappedKeys.push({user: hashedUsername, key: friendWrappedKey });
        if(wrappedKeys.length === encryptedSecret.users.length){
          api.newKey(currentUser, hashedTitle, secret, wrappedKeys);

          var sharedUsersList = document.getElementById('sharedUsers');
          while (sharedUsersList.firstChild) {
            sharedUsersList.removeChild(sharedUsersList.firstChild);
          }
          share(false, hashedTitle, document.getElementById('shareSecretTitle').textContent);
        }
      });
    });
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Unshare';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });

}

function share(e, hashedTitle, title){
  if(typeof(hashedTitle) === 'undefined'){
    hashedTitle  = e.path[1].children[0].textContent;
  }
  if(typeof(title) === 'undefined'){
    title  = e.path[1].children[1].textContent;
  }
  document.getElementById('shareSecretHash').value = hashedTitle;
  document.getElementById('shareSecretTitle').textContent = title;
  document.location.hash = '#shareSecret';
  var sharedUsersList = document.getElementById('sharedUsers');
  api.getSecret(hashedTitle).then(function(encryptedSecret){
    encryptedSecret.users.forEach(function(userHash){
      sharedUsersList.appendChild(uiSharedUsers(userHash));
    });
  });
}

function show(e){
  var hashedTitle  = e.path[1].children[0].textContent;
  var title  = e.path[1].children[1].textContent;
  var btn   = e.target;
  api.getSecret(hashedTitle).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    document.getElementById('showSecretTitle').textContent = title;
    document.getElementById('showSecretContent').value = secret;
    document.location.hash = '#showSecret';
  });
}

function editSecret(e){
  var hashedTitle = e.path[1].children[0].textContent;
  var title  = e.path[1].children[1].textContent;

  api.getSecret(hashedTitle).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    document.getElementById('editSecretHash').value = hashedTitle;
    document.getElementById('editSecretTitle').textContent = title;
    document.getElementById('editSecretContent').value = secret;
    document.location.hash = '#editSecret';
  });
}

function deleteSecret(e){
  var title       = e.path[1].children[1].textContent;
  var hashedTitle = e.path[1].children[0].textContent;
  var sure = confirm('Are you sure to delete ' + title + '?');
  if(sure){
    api.deleteSecret(currentUser, hashedTitle).then(function(){
      return api.getKeys(currentUser.username, currentUser.hash);
    }).then(function(keys){
      currentUser.keys = keys;
      getSecretList(currentUser);
    }, function(err){
      alert(err);
      throw(err);
    });
  }
}

function uiSharedUsers(userHash){
  var elem = document.createElement('li');
  elem.classList.add('sharedUserElem');

  var userHashSpan = document.createElement('span');
  userHashSpan.textContent = userHash;

  var unshareBtn = document.createElement('input');
  unshareBtn.type = 'button';
  unshareBtn.value = 'Unshare';
  unshareBtn.addEventListener('click', unshare);

  elem.appendChild(userHashSpan);
  elem.appendChild(unshareBtn);
  return elem;
}

function uiSecret(hashedTitle, title){
  var elem = document.createElement('li');
  elem.classList.add('secretElem');

  var btn = document.createElement('input');
  btn.type = 'button';
  btn.value = 'Show';
  btn.addEventListener('click', show);

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

  var br = document.createElement('br');

  var hashSpan = document.createElement('span');
  hashSpan.textContent = hashedTitle;
  hashSpan.style.display = 'none';

  elem.appendChild(hashSpan);
  elem.appendChild(titleSpan);
  elem.appendChild(br);
  elem.appendChild(btn);

  if(currentUser.keys[hashedTitle].rights > 0){
    elem.appendChild(editBtn);
  }
  if(currentUser.keys[hashedTitle].rights > 1){
    elem.appendChild(shareBtn);
  }
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
  document.getElementById('search').focus();
}

