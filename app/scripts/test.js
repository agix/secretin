var api  = new API(db)

var invalidUsername = api.getWrappedPrivateKey('toto').then((wrappedPrivateKey) => {
  return wrappedPrivateKey
}, (e) => {
  return e;
})

invalidUsername.then((ret) => {
  console.log('#getWrappedPrivateKey')
  console.log('Invalid username must return "Invalid username"')
  if(ret === 'Invalid username'){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})


var validUsername = api.getWrappedPrivateKey('agix').then((wrappedPrivateKey) => {
  return wrappedPrivateKey
}, (e) => {
  return e;
})

validUsername.then((ret) => {
  console.log('#getWrappedPrivateKey')
  console.log('Valid username must return object with iv and privateKey keys')
  if(JSON.stringify(Object.keys(ret)) === JSON.stringify(['iv', 'privateKey'])){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})


var validUsernameButPassword = api.getWrappedPrivateKey('agix').then((wrappedPrivateKey) => {
  return new User('agix').importPrivateKey('invalidpassword', wrappedPrivateKey)
}).then(() => {
  return 'Valid password'
}, (e) => {
  return e;
})

validUsernameButPassword.then((ret) => {
  console.log('#importPrivateKey')
  console.log('Valid username but password must return "Invalid password"')
  if(ret === 'Invalid password'){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})


var validUsernameAndPassword = api.getWrappedPrivateKey('agix').then((wrappedPrivateKey) => {
  return new User('agix').importPrivateKey('password', wrappedPrivateKey)
}).then(() => {
  return 'Valid password'
}, (e) => {
  return e;
})

validUsernameAndPassword.then((ret) => {
  console.log('#importPrivateKey')
  console.log('Valid username and password must return "Valid password"')
  if(ret === 'Valid password'){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})



var invalidUsername = api.getPublicKey('toto').then((publicKey) => {
  return publicKey
}, (e) => {
  return e;
})

invalidUsername.then((ret) => {
  console.log('#getPublicKey')
  console.log('Invalid username must return "Invalid username"')
  if(ret === 'Invalid username'){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})


var validUsername = api.getPublicKey('agix').then((publicKey) => {
  return publicKey
}, (e) => {
  return e;
})

validUsername.then((ret) => {
  console.log('#getPublicKey')
  console.log('Valid username must return object with iv and privateKey keys')
  if(JSON.stringify(Object.keys(ret)) === JSON.stringify(['alg', 'e', 'ext', 'key_ops', 'kty', 'n'])){
    console.log('Pass')
  }
  else{
    console.log('Fail')
  }
})


// agix.generateMasterKey().then(() => {
//   agix.exportPrivateKey('password').then((privateKey) => {
//     console.log(JSON.stringify(privateKey))
//   })
//   agix.exportPublicKey().then((publicKey) => {
//     console.log(JSON.stringify(publicKey))
//   })
// })


var agix = new User('agix')
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


api.getWrappedPrivateKey(agix.username).then((wrappedPrivateKey) => {
  return agix.importPrivateKey('password', wrappedPrivateKey)
}).then(() => {
  return api.getKeys(agix.username)
}).then((keys) => {
  agix.decryptTitles(keys).then(() => {
    console.log(agix.titles)
    var hash = Object.keys(agix.titles)[0]
    var encryptedSecret = api.getSecret(hash)
    return agix.decryptSecret(encryptedSecret, keys[hash].key)
  }).then((secret) => {
    console.log(secret)
  })
})

