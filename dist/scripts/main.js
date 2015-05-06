'use strict';

var api = new API();
var user;

document.getElementById('db').addEventListener('change', function (e) {
  try {
    var db = JSON.parse(e.target.value);
    api = new API(db);
  } catch (e) {
    console.log('Invalid JSON : ' + e.message);
  }
});

document.getElementById('newUser').addEventListener('click', function (e) {
  var username = document.getElementById('newUsername').value;
  var password = document.getElementById('newPassword').value;
  api.userExists(username).then(function (exists) {
    if (!exists) {
      user = new User(username);
      document.getElementById('newUser').disabled = true;
      user.generateMasterKey().then(function () {
        user.exportPrivateKey(password).then(function (privateKey) {
          user.exportPublicKey().then(function (publicKey) {
            document.getElementById('newUser').disabled = false;
            return api.addUser(user.username, privateKey, publicKey);
          }).then(function () {
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('currentUser').textContent = user.username;
            document.getElementById('secrets').style.display = '';
            document.getElementById('db').value = JSON.stringify(api.db);
          }, function (e) {
            alert(e);
          });
        });
      });
    } else {
      alert('Username already exists');
    }
  });
});

document.getElementById('getKeys').addEventListener('click', function (e) {
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;
  api.getPublicKey(username).then(function (publicKey) {
    user = new User(username);
    return user.importPublicKey(publicKey);
  }).then(function () {
    return api.getWrappedPrivateKey(username);
  }).then(function (wrappedPrivateKey) {
    return user.importPrivateKey(password, wrappedPrivateKey);
  }).then(function () {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('currentUser').textContent = user.username;
    document.getElementById('secrets').style.display = '';
    getSecretList(user);
  }, function (e) {
    alert(e);
  });
});

document.getElementById('addSecret').addEventListener('click', function (e) {
  var title = document.getElementById('secretTitle').value;
  var content = document.getElementById('secretContent').value;
  user.createSecret(title, content).then(function (secret) {
    if (api.addSecret(secret.creator, secret.wrappedKey, secret.iv, secret.encryptedTitle, secret.hashTitle, secret.secret)) {
      document.getElementById('secretTitle').value = '';
      document.getElementById('secretContent').value = '';
      document.getElementById('db').value = JSON.stringify(api.db);
      getSecretList(user);
    } else {
      alert('Secret already exists');
    }
  });
});

function unHide(e) {
  var hash = e.path[1].children[0].textContent;
  var input = e.path[1].children[2];
  var btn = e.path[1].children[3];
  if (e.target.value === 'Unhide') {
    var encryptedSecret = api.getSecret(hash);
    api.getKeys(user.username).then(function (keys) {
      return user.decryptSecret(encryptedSecret, keys[hash].key);
    }).then(function (secret) {
      input.type = 'text';
      input.value = secret;
      btn.value = 'Hide';
    });
  } else {
    input.type = 'password';
    input.value = '********';
    btn.value = 'Unhide';
  }
}

function uiSecret(title) {
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

  var titleSpan = document.createElement('span');
  titleSpan.textContent = title.clear.substring(14);

  var hash = document.createElement('span');
  hash.textContent = title.hash;
  hash.style.display = 'none';
  elem.appendChild(hash);
  elem.appendChild(titleSpan);
  elem.appendChild(secret);
  elem.appendChild(btn);
  return elem;
}

function getSecretList() {
  var secretsList = document.getElementById('secretsList');
  var oldElems = document.querySelectorAll('.secretElem');
  for (var i = 0; i < oldElems.length; i++) {
    secretsList.removeChild(oldElems[i]);
  }
  api.getKeys(user.username).then(function (keys) {
    return user.decryptTitles(keys);
  }).then(function () {
    user.titles.forEach(function (title) {
      secretsList.appendChild(uiSecret(title));
    });
  });
}

// var agix = new User('agix')
// // var clearTitle  = 'my love'
// // var clearSecret = 'la maman de jordan'

// // var now = Date.now()

// // api.getPublicKey('agix').then((publicKey) => {
// //   return agix.importPublicKey(publicKey)
// // }).then(() => {
// //   return agix.encryptSecret(now+'|'+clearTitle, clearSecret)
// // }).then((secret) => {
// //   db.secrets[secret.title] = {secret: secret.secret, iv: secret.iv, users:[]}

// //   agix.wrapKey(secret.key, agix.publicKey, agix.username).then((wrappedKey) => {
// //     db.secrets[secret.title].users.push(wrappedKey.username)

// //     agix.encryptTitle(now+'|'+clearTitle, agix.publicKey).then((encryptedTitle) => {
// //       db.users[wrappedKey.username].keys[secret.title] = {title: encryptedTitle, key: wrappedKey.key, right: 3}

// //       console.log(JSON.stringify(db))
// //     })
// //   })
// // })

// api.getWrappedPrivateKey(agix.username).then((wrappedPrivateKey) => {
//   return agix.importPrivateKey('password', wrappedPrivateKey)
// }).then(() => {
//   return api.getKeys(agix.username)
// }).then((keys) => {
//   agix.decryptTitles(keys).then(() => {
//     console.log(agix.titles)
//     var encryptedSecret = api.getSecret(agix.titles[0].hash)
//     return agix.decryptSecret(encryptedSecret, keys[agix.titles[0].hash].key)
//   }).then((secret) => {
//     console.log(secret)
//   })
// })