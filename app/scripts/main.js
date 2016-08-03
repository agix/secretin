document.addEventListener("DOMContentLoaded", function() {

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
  getKeys(username, password).then(function(){
    btn.disabled = false;
    btn.value = 'Get keys';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('userTitle').textContent = currentUser.username+'\'s secrets';
    document.getElementById('secrets').style.display = '';
    document.getElementById('login').style.display = 'none';
    document.getElementById('deco').style.display = '';
    getSecretList();
  }, function(err){
    btn.disabled = false;
    btn.value = 'Get keys';
    error(document.getElementById('errorLogin'), err);
    throw(err);
  });
});

document.getElementById('addSecretPopup').addEventListener('click', function(e){
  var secret = new Secret();

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
    addSecret(metadatas, secret).then(function(){
      secret.destroy();
      cleanElement(secretContent);
      document.getElementById('popupTitle').value = '';
      document.location.href = '#keys';
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
  var metadatas = currentUser.metadatas[hashedTitle];

  getSecret(hashedTitle).then(function(secretDatas){
    var secret = new Secret(secretDatas);
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
        editSecret(hashedTitle, metadatas, secret).then(function(){
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
    if(currentUser.keys[hashedTitle].rights > 0){
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
  var rights = document.getElementById('rights').value;
  e.target.disabled = true;
  e.target.value = 'Please wait...';
  shareSecret(hashedTitle, friendName, rights).then(function(users){
    e.target.disabled = false;
    e.target.value = 'Share';
    document.getElementById('friendName').value = '';
    share(false, hashedTitle, document.getElementById('shareSecretTitle').textContent);
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
  unshareSecret(hashedTitle, friendName).then(function(){
    return refreshKeys();
  }).then(function(){
    share(false, hashedTitle, document.getElementById('shareSecretTitle').textContent);
  }, function(err){
    e.target.disabled = false;
    e.target.value = 'Unshare';
    error(document.getElementById('errorShareSecret'), err);
    throw(err);
  });

}

document.getElementById('refresh').addEventListener('click', function(e){
  document.getElementById('search').value = '';
  refreshKeys().then(function(){
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

document.getElementById('getDb').addEventListener('click', function(e) {
  if(typeof currentUser !== 'undefined' && typeof currentUser.username !== 'undefined'){
    api.getDb(currentUser.username, currentUser.hash).then(function(db){
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
    deleteSecret(hashedTitle).then(function(){
      getSecretList();
    }, function(err){
      alert(err);
      throw(err);
    });
  }
}

function share(e, hashedTitle, title){
  if(typeof(hashedTitle) === 'undefined'){
    hashedTitle = e.path[1].children[0].textContent;
  }
  if(typeof(title) === 'undefined'){
    title  = e.path[1].children[1].textContent;
  }
  document.getElementById('shareSecretHash').value = hashedTitle;
  document.getElementById('shareSecretTitle').textContent = title;
  document.location.hash = '#shareSecret';


  var sharedUsersList = document.getElementById('sharedUsers');
  while (sharedUsersList.firstChild) {
    sharedUsersList.removeChild(sharedUsersList.firstChild);
  }
  Object.keys(currentUser.metadatas[hashedTitle].users).forEach(function(user){
    sharedUsersList.appendChild(uiSharedUsers(user));
  });
}

function getSecretList(){
  var secretsList = document.getElementById('secretsList');
  var oldElems = secretsList.querySelectorAll('.secretElem');

  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  getAllMetadatas().then(function(){
    Object.keys(currentUser.metadatas).forEach(function(hashedTitle){
      secretsList.appendChild(uiSecretList(hashedTitle, currentUser.metadatas[hashedTitle].title));
    });
  });
  document.getElementById('search').focus();
}

