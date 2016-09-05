document.addEventListener("DOMContentLoaded", function() {

document.getElementById('newUser').addEventListener('click', function(e) {
  var btn = e.target;
  var username = document.getElementById('newUsername').value;
  var password = document.getElementById('newPassword').value;
  btn.disabled = true;
  btn.value = 'Please wait...';
  secretin.newUser(username, password).then(function(msg){
    document.location.href = '#keys';
    btn.disabled = false;
    btn.value = 'Generate';
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('userTitle').textContent = secretin.currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    document.getElementById('deco').style.display = '';
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
  }, function(err){
    btn.disabled = false;
    btn.value = 'Generate';
    error(document.getElementById('errorNew'), err);
    throw(err);
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
  secretin.getKeys(username, password).then(function(){
    btn.disabled = false;
    btn.value = 'Get keys';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('userTitle').textContent = secretin.currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    document.getElementById('deco').style.display = '';
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
  }, function(err){
    btn.disabled = false;
    btn.value = 'Get keys';
    error(document.getElementById('errorLogin'), err);
    throw(err);
  });
});


document.getElementById('createFolder').addEventListener('click', function(e){
  document.getElementById('folderPopupTitle').textContent = 'New folder';
  var folderContent = document.getElementById('folderContent');

  var title = document.createElement('input');
  title.type = 'text';
  title.placeholder = 'Folder title';

  folderContent.appendChild(title);

  var createFolderBtn = document.createElement('input');
  createFolderBtn.type = 'button';
  createFolderBtn.classList.add('btn3');
  createFolderBtn.value = 'New folder';
  createFolderBtn.addEventListener('click', function(e){
    var metadatas = {title: title.value, type: 'folder'};
    secretin.addSecret(metadatas, {}).then(function(){
      cleanElement(folderContent);
      document.getElementById('folderPopupTitle').value = '';
      document.location.href = '#keys';
      return secretin.getAllMetadatas();
    }).then(function(){
      getSecretList();
    }, function(err){
      alert(err);
      throw(err);
    });

  });

  cleanElement(document.getElementById('folderPopupBottom'));
  document.getElementById('folderPopupBottom').appendChild(createFolderBtn);

  var popupClose = document.createElement('a');
  popupClose.classList.add('close');
  popupClose.textContent = '×';
  popupClose.addEventListener('click', function(e){
    cleanElement(folderContent);
    document.getElementById('folderPopupTitle').value = '';
    document.location.href = '#keys';
  });

  var folderPopup = document.getElementById('folderPopup').querySelector('.popup');
  folderPopup.insertBefore(popupClose, folderContent);
});

document.getElementById('addSecretPopup').addEventListener('click', function(e){
  var secret = new Secret('secret');

  document.getElementById('popupTitle').textContent = 'Add secret';
  var secretContent = document.getElementById('secretContent');

  var title = document.createElement('input');
  title.type = 'text';
  title.placeholder = 'Secret title';

  var addSecretBtn = document.createElement('input');
  addSecretBtn.type = 'button';
  addSecretBtn.classList.add('btn3');
  addSecretBtn.value = 'Add Secret';
  addSecretBtn.addEventListener('click', function(e){
    var metadatas = {title: title.value};
    secretin.addSecret(metadatas, secret).then(function(){
      secret.destroy();
      cleanElement(secretContent);
      document.getElementById('popupTitle').value = '';
      document.location.href = '#keys';
      return secretin.getAllMetadatas();
    }).then(function(){
      getSecretList();
    }, function(err){
      alert(err);
      throw(err);
    });

  });

  secretContent.appendChild(title);
  secret.draw(secretContent);

  cleanElement(document.getElementById('popupBottom'));
  document.getElementById('popupBottom').appendChild(addSecretBtn);

  var popupClose = document.createElement('a');
  popupClose.classList.add('close');
  popupClose.textContent = '×';
  popupClose.addEventListener('click', function(e){
    secret.destroy();
    cleanElement(secretContent);
    document.getElementById('popupTitle').value = '';
    document.location.href = '#keys';
  });

  var secretPopup = document.getElementById('secretPopup').querySelector('.popup');
  secretPopup.insertBefore(popupClose, secretContent);
});


function showSecretPopup(e){

  var hashedTitle  = e.path[1].children[0].textContent;
  var metadatas = secretin.currentUser.metadatas[hashedTitle];

  secretin.getSecret(hashedTitle).then(function(secretDatas){
    var secret = new Secret('secret', secretDatas);
    var secretContent = document.getElementById('secretContent');
    document.getElementById('popupTitle').textContent = metadatas.title;
    secret.draw(secretContent);

    var editSecretBtn = document.createElement('input');
    editSecretBtn.type = 'button';
    editSecretBtn.classList.add('btn3');
    editSecretBtn.value = 'Edit Secret';
    editSecretBtn.addEventListener('click', function(e){
      if(e.target.value === 'Edit Secret'){
        e.target.value = 'Save Secret';
        secret.editable = true;
        secret.redraw();
      }
      else{
        secretin.editSecret(hashedTitle, metadatas, secret).then(function(){
          secret.editable = false;
          secret.redraw();
          e.target.value = 'Edit Secret';
        }, function(err){
          alert(err);
          throw(err);
        });
      }
    });

    cleanElement(document.getElementById('popupBottom'));
    if(secretin.currentUser.keys[hashedTitle].rights > 0){
      document.getElementById('popupBottom').appendChild(editSecretBtn);
    }

    document.location.hash = '#secretPopup';

    var popupClose = document.createElement('a');
    popupClose.classList.add('close');
    popupClose.textContent = '×';
    popupClose.addEventListener('click', function(e){
      secret.destroy();
      cleanElement(secretContent);
      document.getElementById('popupTitle').value = '';
      document.location.href = '#keys';
    });

    var secretPopup = document.getElementById('secretPopup').querySelector('.popup');
    secretPopup.insertBefore(popupClose, secretContent);
  });
}

function cleanElement(elem){
  while (elem.firstChild) {
    elem.removeChild(elem.firstChild);
  }
}

document.getElementById('changePasswordBtn').addEventListener('click', function(e) {
  var btn = e.target;
  var password = document.getElementById('changePasswordInput').value;
  var pass = {};
  btn.disabled = true;
  btn.value = 'Please wait...';
  secretin.changePassword(password).then(function(msg){
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
  timeout = setTimeout(function() { destroyUser(secretin.currentUser); secretin.currentUser = {}; }, 60000);
});

document.getElementById('deco').addEventListener('click', function(e){
  destroyUser(secretin.currentUser);
  secretin.currentUser = {};
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

document.getElementById('share').addEventListener('click', function(e){
  var hashedTitle = document.getElementById('shareSecretHash').value;
  var friendName = document.getElementById('friendName').value;
  var rights = parseInt(document.getElementById('rights').value);
  var type = document.querySelector('input[name="type"]:checked').value;

  e.target.disabled = true;
  e.target.value = 'Please wait...';
  secretin.shareSecret(hashedTitle, friendName, rights, type).then(function(users){
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
    e.target.disabled = false;
    e.target.value = 'Share';
    document.getElementById('friendName').value = '';
    share(false, hashedTitle);
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Share';
    document.getElementById('friendName').value='';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });
});


function unshare(e){
  var hashedTitle = document.getElementById('shareSecretHash').value;
  var friendName = e.path[1].children[0].textContent;
  e.target.disabled = true;
  e.target.value = 'Please wait...';
  secretin.unshareSecret(hashedTitle, friendName).then(function(){
    return secretin.refreshKeys();
  }).then(function(){
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
    share(false, hashedTitle);
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Unshare';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });

}

function removeFromFolder(e, hashedFolder){
  var hashedTitle = document.getElementById('shareSecretHash').value;
  e.target.disabled = true;
  e.target.value = 'Please wait...';
  secretin.removeSecretFromFolder(hashedTitle, hashedFolder).then(function(){
    return secretin.refreshKeys();
  }).then(function(){
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
    share(false, hashedTitle);
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Unshare';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });
}

document.getElementById('refresh').addEventListener('click', function(e){
  document.getElementById('search').value = '';
  secretin.refreshKeys().then(function(){
    return secretin.getAllMetadatas();
  }).then(function(){
    getSecretList();
  }, function(err){
    alert(err);
    throw(err);
  });
});

document.getElementById('changePasswordA').addEventListener('click', function(e){
  setTimeout(function(){ document.getElementById('changePasswordInput').focus(); }, 100);
});

document.getElementById('search').addEventListener('keyup', function(e){
  var str = e.target.value.toLowerCase();
  if(str.length > 2){
    getSecretList(true);
  }
  else{
    getSecretList();
  }
  var elems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < elems.length; i++) {
    if(str.length > 2 && elems[i].children[1].textContent.toLowerCase().indexOf(str) === -1){
      elems[i].style.display = 'none';
    }
    else{
      elems[i].style.display = '';
    }
  }
});

document.getElementById('radioFolder').addEventListener('click', function(e) {
  document.getElementById('rights').style.display = 'none';
});

document.getElementById('radioUser').addEventListener('click', function(e) {
  document.getElementById('rights').style.display = '';
});

document.getElementById('getDb').addEventListener('click', function(e) {
  if(typeof secretin.currentUser !== 'undefined' && typeof secretin.currentUser.username !== 'undefined'){
    secretin.api.getDb(secretin.currentUser.username, secretin.currentUser.hash).then(function(db){
      document.getElementById('db').value = JSON.stringify(db);
    });
  }
  else{
    document.getElementById('db').value = 'Not connected !';
    setTimeout(function(){ document.getElementById('db').value = ''; }, 1000);
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
  document.location.hash = '#keys';
  user.disconnect();
}

document.getElementById('editSecret').addEventListener('click', function(e){
  var popup = document.getElementById('showSecret');
  var content = popup.getElementsByClassName('content')[0];

  document.getElementById('saveSecret').style.display = '';
  document.getElementById('hideSecret').textContent = 'Cancel';
});

function uiDeleteSecret(e){
  var title       = e.path[1].children[1].textContent;
  var hashedTitle = e.path[1].children[0].textContent;
  var sure = confirm('Are you sure to delete ' + title + '?');
  if(sure){
    secretin.deleteSecret(hashedTitle).then(function(){
      return secretin.refreshKeys();
    }).then(function(){
      return secretin.getAllMetadatas();
    }).then(function(){
      getSecretList();
    }, function(err){
      alert(err);
      throw(err);
    });
  }
}

function share(e, hashedTitle){
  var metadatas = secretin.currentUser.metadatas[hashedTitle];

  document.getElementById('shareSecretHash').value = hashedTitle;
  if(metadatas.type === 'folder'){
    document.getElementById('radioUser').checked = 'checked';
    document.getElementById('rights').style.display = '';
    document.getElementById('shareSecretTitle').textContent = 'Folder '+metadatas.title;
  }
  else{
    document.getElementById('shareSecretTitle').textContent = metadatas.title;
  }

  document.location.hash = '#shareSecret';


  var sharedUsersList = document.getElementById('sharedUsers');
  while (sharedUsersList.firstChild) {
    sharedUsersList.removeChild(sharedUsersList.firstChild);
  }
  Object.keys(secretin.currentUser.metadatas[hashedTitle].users).forEach(function(user){
    if(secretin.currentUser.username !== user){
      sharedUsersList.appendChild(uiSharedUsers(user, secretin.currentUser.metadatas[hashedTitle].users[user]));
    }
  });
  Object.keys(secretin.currentUser.metadatas[hashedTitle].folders).forEach(function(folder){
    sharedUsersList.appendChild(uiSharedFolder(secretin.currentUser.metadatas[hashedTitle].folders[folder].name));
  });
}

function getSecretList(all){
  var secretsList = document.getElementById('secretsList');
  var oldElems = secretsList.querySelectorAll('.secretElem');

  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }

  if(typeof(secretin.currentUser.currentFolder) !== 'undefined'){
    var elem = document.createElement('li');
    elem.classList.add('secretElem');
    var titleSpan = document.createElement('span');
    titleSpan.textContent = 'Folder '+secretin.currentUser.metadatas[secretin.currentUser.currentFolder].title;
    elem.appendChild(titleSpan);
    var br = document.createElement('br');
    elem.appendChild(br);

    var btn = document.createElement('input');
    btn.type = 'button';
    btn.value = 'Return';
    btn.addEventListener('click', function(e){ delete secretin.currentUser.currentFolder; getSecretList(); });
    elem.appendChild(btn);
    secretsList.appendChild(elem);
    if(secretin.currentUser.keys[secretin.currentUser.currentFolder].rights > 1){
      document.getElementById('addSecretPopup').style.display = '';
      document.getElementById('createFolder').style.display = '';
    }
    else{
      document.getElementById('addSecretPopup').style.display = 'none';
      document.getElementById('createFolder').style.display = 'none';
    }
  }
  else{
    document.getElementById('addSecretPopup').style.display = '';
    document.getElementById('createFolder').style.display = '';
  }



  Object.keys(secretin.currentUser.metadatas).forEach(function(hashedTitle){
    var knowFolder = false;
    Object.keys(secretin.currentUser.metadatas[hashedTitle].folders).forEach(function(hashedFolder){
      if(typeof(secretin.currentUser.metadatas[hashedFolder]) !== 'undefined'){
        knowFolder = true;
      }
    });

    if(
      (typeof(secretin.currentUser.currentFolder) === 'undefined' && Object.keys(secretin.currentUser.metadatas[hashedTitle].folders).length === 0) ||
      (typeof(secretin.currentUser.currentFolder) === 'undefined' && !knowFolder) ||
      (typeof(secretin.currentUser.currentFolder) !== 'undefined' && typeof(secretin.currentUser.metadatas[hashedTitle].folders[secretin.currentUser.currentFolder]) !== 'undefined') ||
      all
    ){
      secretsList.appendChild(uiSecretList(hashedTitle, secretin.currentUser.metadatas[hashedTitle]));
    }
  });
  document.getElementById('search').focus();
}

function uiSharedUsers(username, metadatas){
  var elem = document.createElement('li');
  elem.classList.add('sharedUserElem');

  var userSpan = document.createElement('span');
  userSpan.textContent = username;

  var userRightsSpan = document.createElement('span');
  if(metadatas.rights === 0){
    userRightsSpan.textContent = 'Read';
  }
  else if(metadatas.rights === 1){
    userRightsSpan.textContent = 'Read/Write';
  }
  else{
    userRightsSpan.textContent = 'Read/Write/Share';
  }

  var unshareBtn = document.createElement('input');
  unshareBtn.type = 'button';
  unshareBtn.value = 'Unshare';
  unshareBtn.addEventListener('click', unshare);

  elem.appendChild(userSpan);
  elem.appendChild(userRightsSpan);

  if(typeof(metadatas.folder) !== 'undefined'){
    var folderSpan = document.createElement('span');
    folderSpan.textContent = 'via '+metadatas.folder;
    elem.appendChild(folderSpan);
  }
  else{
    userSpan.style.cursor = 'pointer';
    userSpan.addEventListener('click', function(e){
      document.getElementById('friendName').value = username;
      document.getElementById('rights').selectedIndex = metadatas.rights;
    });
    elem.appendChild(unshareBtn);
  }

  return elem;
}

function uiSharedFolder(folderName){
  var hashedFolder;
  Object.keys(secretin.currentUser.metadatas).forEach(function(hashedTitle){
    if(secretin.currentUser.metadatas[hashedTitle].title === folderName){
      hashedFolder = hashedTitle;
    }
  });

  var elem = document.createElement('li');
  elem.classList.add('sharedUserElem');

  var folderSpan = document.createElement('span');
  folderSpan.textContent = 'Folder '+folderName;

  elem.appendChild(folderSpan);
  if(typeof hashedFolder !== 'undefined'){
    var unshareBtn = document.createElement('input');
    unshareBtn.type = 'button';
    unshareBtn.value = 'Unshare';
    unshareBtn.addEventListener('click', function(e){ removeFromFolder(e, hashedFolder); });
    elem.appendChild(unshareBtn);
  }

  return elem;
}

function uiSecretList(hashedTitle, metadatas){
  var elem = document.createElement('li');
  elem.classList.add('secretElem');

  var btn = document.createElement('input');
  btn.type = 'button';
  if(metadatas.type !== 'folder'){
    btn.value = 'Show';
    btn.addEventListener('click', showSecretPopup);
  }
  else{
    btn.value = 'Open';
    btn.addEventListener('click', function(e){ secretin.currentUser.currentFolder = hashedTitle; getSecretList(); });
  }


  var shareBtn = document.createElement('input');
  shareBtn.type = 'button';
  shareBtn.value = 'Share';

  shareBtn.addEventListener('click', function(e){ share(e, hashedTitle); });

  var deleteBtn = document.createElement('input');
  deleteBtn.type = 'button';
  deleteBtn.value = 'Delete';
  deleteBtn.addEventListener('click', uiDeleteSecret);

  var titleSpan = document.createElement('span');
  if(metadatas.type === 'folder'){
    titleSpan.textContent = 'Folder '+metadatas.title;
  }
  else{
    titleSpan.textContent = metadatas.title;
  }

  var br = document.createElement('br');

  var hashSpan = document.createElement('span');
  hashSpan.textContent = hashedTitle;
  hashSpan.style.display = 'none';

  elem.appendChild(hashSpan);
  elem.appendChild(titleSpan);
  elem.appendChild(br);
  elem.appendChild(btn);


  if(secretin.currentUser.keys[hashedTitle].rights > 1){
    elem.appendChild(shareBtn);
    if(Object.keys(metadatas.folders).length === 0 || secretin.currentUser.currentFolder in metadatas.folders){
      elem.appendChild(deleteBtn);
    }
  }

  return elem;
}