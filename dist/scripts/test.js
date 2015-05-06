'use strict';

var api = new API(db);

var invalidUsername = api.getWrappedPrivateKey('toto').then(function (wrappedPrivateKey) {
  return wrappedPrivateKey;
}, function (e) {
  return e;
});

invalidUsername.then(function (ret) {
  console.log('#getWrappedPrivateKey');
  console.log('Invalid username must return "Invalid username"');
  if (ret === 'Invalid username') {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

var validUsername = api.getWrappedPrivateKey('agix').then(function (wrappedPrivateKey) {
  return wrappedPrivateKey;
}, function (e) {
  return e;
});

validUsername.then(function (ret) {
  console.log('#getWrappedPrivateKey');
  console.log('Valid username must return object with iv and privateKey keys');
  if (JSON.stringify(Object.keys(ret)) === JSON.stringify(['iv', 'privateKey'])) {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

var validUsernameButPassword = api.getWrappedPrivateKey('agix').then(function (wrappedPrivateKey) {
  return new User('agix').importPrivateKey('invalidpassword', wrappedPrivateKey);
}).then(function () {
  return 'Valid password';
}, function (e) {
  return e;
});

validUsernameButPassword.then(function (ret) {
  console.log('#importPrivateKey');
  console.log('Valid username but password must return "Invalid password"');
  if (ret === 'Invalid password') {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

var validUsernameAndPassword = api.getWrappedPrivateKey('agix').then(function (wrappedPrivateKey) {
  return new User('agix').importPrivateKey('password', wrappedPrivateKey);
}).then(function () {
  return 'Valid password';
}, function (e) {
  return e;
});

validUsernameAndPassword.then(function (ret) {
  console.log('#importPrivateKey');
  console.log('Valid username and password must return "Valid password"');
  if (ret === 'Valid password') {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

var invalidUsername = api.getPublicKey('toto').then(function (publicKey) {
  return publicKey;
}, function (e) {
  return e;
});

invalidUsername.then(function (ret) {
  console.log('#getPublicKey');
  console.log('Invalid username must return "Invalid username"');
  if (ret === 'Invalid username') {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

var validUsername = api.getPublicKey('agix').then(function (publicKey) {
  return publicKey;
}, function (e) {
  return e;
});

validUsername.then(function (ret) {
  console.log('#getPublicKey');
  console.log('Valid username must return object with iv and privateKey keys');
  if (JSON.stringify(Object.keys(ret)) === JSON.stringify(['alg', 'e', 'ext', 'key_ops', 'kty', 'n'])) {
    console.log('Pass');
  } else {
    console.log('Fail');
  }
});

// agix.generateMasterKey().then(() => {
//   agix.exportPrivateKey('password').then((privateKey) => {
//     console.log(JSON.stringify(privateKey))
//   })
//   agix.exportPublicKey().then((publicKey) => {
//     console.log(JSON.stringify(publicKey))
//   })
// })

var agix = new User('agix');
// var clearTitle  = 'my love'
// var clearSecret = 'la maman de jordan'

// var now = Date.now()

// api.getPublicKey('agix').then((publicKey) => {
//   return agix.importPublicKey(publicKey)
// }).then(() => {
//   return agix.encryptSecret(now+'|'+clearTitle, clearSecret)
// }).then((secret) => {
//   db.secrets[secret.title] = {secret: secret.secret, iv: secret.iv, users:[]}

//   agix.wrapKey(secret.key, agix.publicKey, agix.username).then((wrappedKey) => {
//     db.secrets[secret.title].users.push(wrappedKey.username)

//     agix.encryptTitle(now+'|'+clearTitle, agix.publicKey).then((encryptedTitle) => {
//       db.users[wrappedKey.username].keys[secret.title] = {title: encryptedTitle, key: wrappedKey.key, right: 3}

//       console.log(JSON.stringify(db))
//     })
//   })
// })

api.getWrappedPrivateKey(agix.username).then(function (wrappedPrivateKey) {
  return agix.importPrivateKey('password', wrappedPrivateKey);
}).then(function () {
  return api.getKeys(agix.username);
}).then(function (keys) {
  agix.decryptTitles(keys).then(function () {
    console.log(agix.titles);
    var encryptedSecret = api.getSecret(agix.titles[0].hash);
    return agix.decryptSecret(encryptedSecret, keys[agix.titles[0].hash].key);
  }).then(function (secret) {
    console.log(secret);
  });
});