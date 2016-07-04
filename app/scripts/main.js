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
    getSecretList(currentUser);
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
    getSecretList(currentUser);
  }, function(err){
    btn.disabled = false;
    btn.value = 'Get keys';
    error(document.getElementById('errorLogin'), err);
    throw(err);
  });
});

document.getElementById('addSecret').addEventListener('click', function(e){
  var title   = document.getElementById('secretTitle').value;
  var content = document.getElementById('secretContent').value;
  addSecret(title, content).then(function(){
    document.getElementById('secretTitle').value = '';
    document.getElementById('secretContent').value = '';
    document.location.href = '#keys';
    getSecretList(currentUser);
  }, function(err){
    alert(err);
    throw(err);
  });
});

document.getElementById('changePasswordBtn').addEventListener('click', function(e) {
  var btn = e.target;
  var password = document.getElementById('changePasswordInput').value;
  var pass = {};
  btn.disabled = true;
  btn.value = 'Please wait...';
  changePassword.then(function(msg){
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
  var content = document.getElementById('showSecretContent')
  for (var c in content.childNodes) {
    var child = content.childNodes[c];
    if( child instanceof Element && child.id != 'hideSecret') {
      content.removeChild(child);
    }
  }
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
  editSecret(hashedTitle, content).then(function(){
    alert('Secret saved');
  }, function(err){
    alert(err);
    throw(err);
  });
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

document.getElementById('copy').addEventListener('click', function(e) {
  e.target.getAttribute('target-id');
  document.getElementById('showSecretText').select();
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

function show(e){

  var hashedTitle  = e.path[1].children[0].textContent;
  var title  = e.path[1].children[1].textContent;

  getSecret(hashedTitle).then(function(secretContent){

    var secret = new Secret(title, secretContent);

    var fieldsUI = uiSecretFields(secret);

    var popup = document.getElementById('showSecret');
    var content = popup.getElementsByClassName("content")[0];

    var hideButton = document.getElementById('hideSecret');

    content.insertBefore(fieldsUI, hideButton);

    document.getElementById('showSecretTitle').textContent = title;

    document.location.hash = '#showSecret';
  });
}

function uiEditSecret(e){
  var hashedTitle = e.path[1].children[0].textContent;
  var title  = e.path[1].children[1].textContent;

  getSecret(hashedTitle).then(function(secret){
    document.getElementById('editSecretHash').value = hashedTitle;
    document.getElementById('editSecretTitle').textContent = title;
    document.getElementById('editSecretContent').value = secret;
    document.location.hash = '#editSecret';
  });
}

function uiDeleteSecret(e){
  var title       = e.path[1].children[1].textContent;
  var hashedTitle = e.path[1].children[0].textContent;
  var sure = confirm('Are you sure to delete ' + title + '?');
  if(sure){
    deleteSecret(hashedTitle).then(function(){
      getSecretList(currentUser);
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

  getSharedUsers(hashedTitle).then(function(users){
    var sharedUsersList = document.getElementById('sharedUsers');
    while (sharedUsersList.firstChild) {
      sharedUsersList.removeChild(sharedUsersList.firstChild);
    }
    users.forEach(function(userHash){
      sharedUsersList.appendChild(uiSharedUsers(userHash));
    });
  });
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

