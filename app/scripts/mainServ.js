document.addEventListener("DOMContentLoaded", function() {

var api = new API();
var currentUser;

if(document.getElementById('db')){
  document.getElementById('db').addEventListener('change', function(e) {
    try{
      var db = JSON.parse(e.target.value)
      api = new API(db);
    }
    catch (e){
      console.log('Invalid JSON : ' + e.message)
    }
  });
}

if(document.getElementById('dbUri')){
  document.getElementById('dbUri').addEventListener('change', function(e) {
    var db = e.target.value
    api = new API(db);
  });
}

document.getElementById('newUser').addEventListener('click', function(e) {
  var username = document.getElementById('newUsername').value
  var password = document.getElementById('newPassword').value
  api.userExists(username).then(function(exists){
    if(!exists){
      currentUser = new User(username)
      document.getElementById('newUser').disabled = true
      currentUser.generateMasterKey().then(function(){
        currentUser.exportPrivateKey(password).then(function(privateKey){
          currentUser.exportPublicKey().then(function(publicKey){
            document.getElementById('newUser').disabled = false
            return api.addUser(currentUser.username, privateKey, publicKey)
          }).then(function(msg){
            document.getElementById('newUsername').value = ''
            document.getElementById('newPassword').value = ''
            document.getElementById('currentUser').textContent = currentUser.username;
            document.getElementById('secrets').style.display = '';
            setTimeout(function(){ getSecretList(currentUser); }, 1000);
          }, function(err){
            alert(err);
            throw(err);
          })
        })
      })
    }
    else{
      alert('Username already exists')
    }
  })
});

document.getElementById('getKeys').addEventListener('click', function(e){
  var username = document.getElementById('username').value
  var password = document.getElementById('password').value
  var remoteUser;
  api.getUser(username).then(function(user){
    currentUser = new User(username)
    remoteUser = user;
    currentUser.keys = remoteUser.keys;
    return currentUser.importPublicKey(remoteUser.publicKey);
  }).then(function(){
    return currentUser.importPrivateKey(password, remoteUser.privateKey);
  }).then(function(){
    document.getElementById('username').value = ''
    document.getElementById('password').value = ''
    document.getElementById('currentUser').textContent = currentUser.username;
    document.getElementById('secrets').style.display = '';
    getSecretList(currentUser)
  }, function(err){
    alert(err);
    throw(err);
  })

})

document.getElementById('addSecret').addEventListener('click', function(e){
  var title = document.getElementById('secretTitle').value
  var content = document.getElementById('secretContent').value
  currentUser.createSecret(title, content).then(function(secret){
    return api.addSecret(secret.creator, secret.wrappedKey, secret.iv, secret.encryptedTitle, secret.hashedTitle, secret.secret)
  }).then(function(msg){
    document.getElementById('secretTitle').value = ''
    document.getElementById('secretContent').value = ''
    if(document.getElementById('db')){
      document.getElementById('db').value = JSON.stringify(api.db)
    }
    getSecretList(currentUser)
  }, function(err){
    alert(err)
    throw(err);
  })
})

var timeout;

window.addEventListener('focus', function() {
  clearInterval(timeout)
});

window.addEventListener('blur', function() {
  timeout = setTimeout(function() { destroyUser(currentUser) }, 30000)
});


document.getElementById('deco').addEventListener('click', function(e){
  destroyUser(currentUser);
});

function destroyUser(user){
  var secretsList = document.getElementById('secretsList')
  var oldElems = document.querySelectorAll('.secretElem')
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i])
  }
  document.getElementById('currentUser').textContent = 'Not connected';
  document.getElementById('secrets').style.display = 'none';
  user.disconnect();
}

function share(e){
  var hash  = e.path[1].children[0].textContent
  var encryptedSecret;
  var friend;
  var rights;
  var result = {};
  api.getSecret(hash).then(function(eSecret){
    encryptedSecret = eSecret
    var friendName = prompt('Which friend ?')
    rights = prompt('Which rights (0=read, 1=+write, 2=+share) ?')
    friend = new User(friendName)
    e.target.disabled = true
    return api.getPublicKey(friend.username)
  }).then(function(publicKey){
    return friend.importPublicKey(publicKey)
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hash].key, hash)
  }).then(function(result){
    return api.shareSecret(currentUser, result.friendName, result.wrappedKey, result.encryptedTitle, hash, rights)
  }).then(function(){
    if(document.getElementById('db')){
      document.getElementById('db').value = JSON.stringify(api.db)
    }
    e.target.disabled = false
  }, function(err){
    e.target.disabled = false
    alert(err)
    throw(err);
  })
}

function unHide(e){
  var hash  = e.path[1].children[0].textContent
  var input = e.path[1].children[2]
  var btn   = e.target
  if(btn.value === 'Unhide'){
    var encryptedSecret;
    api.getSecret(hash).then(function(eSecret){
      encryptedSecret = eSecret;
      return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hash].key)
    }).then(function(secret){
      input.type  = 'text'
      input.value = secret
      btn.value   = 'Hide'
    })
  }
  else{
    input.type  = 'password'
    input.value = '********'
    btn.value   = 'Unhide'
  }
}

// function editSecret(e){
//   var hash  = e.path[1].children[0].textContent
//   var btn   = e.path[1].children[3]
//   if(btn.value === '')
//   console.log(hash)

// }

function uiSecret(hash, title){

  var elem = document.createElement('li')
  elem.classList.add('secretElem')
  var secret = document.createElement('input')
  secret.type = 'password'
  secret.value = '********'
  secret.disabled = true
  //secret.addEventListener('dblclick', editSecret)

  var btn = document.createElement('input')
  btn.type = 'button'
  btn.value = 'Unhide'
  btn.addEventListener('click', unHide)

  var shareBtn = document.createElement('input')
  shareBtn.type = 'button'
  shareBtn.value = 'Share'
  shareBtn.addEventListener('click', share)

  var titleSpan = document.createElement('span')
  titleSpan.textContent = title.substring(14)

  var hashSpan = document.createElement('span')
  hashSpan.textContent = hash
  hashSpan.style.display = "none"
  elem.appendChild(hashSpan)
  elem.appendChild(titleSpan)
  elem.appendChild(secret)
  elem.appendChild(btn)
  elem.appendChild(shareBtn)
  return elem;
}

function getSecretList(){
  var secretsList = document.getElementById('secretsList')
  var oldElems = document.querySelectorAll('.secretElem')
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i])
  }
  currentUser.decryptTitles().then(function(){
    Object.keys(currentUser.titles).forEach(function(hash){
      secretsList.appendChild(uiSecret(hash, currentUser.titles[hash]))
    })
  })
}

});