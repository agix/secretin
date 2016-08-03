
// ###################### secretin.js ######################

function newUser(username, password){
  return api.userExists(username).then(function(exists){
    if(!exists){
      var result = {};
      var pass = {};
      currentUser = new User(username);
      return currentUser.generateMasterKey().then(function(){
        return derivePassword(password);
      }).then(function(dKey){
        pass.salt = bytesToHexString(dKey.salt);
        pass.hash = bytesToHexString(dKey.hash);
        pass.iterations = dKey.iterations;
        currentUser.hash = pass.hash;
        return currentUser.exportPrivateKey(dKey.key);
      }).then(function(privateKey){
        result.privateKey = privateKey;
        return currentUser.exportPublicKey();
      }).then(function(publicKey){
        result.publicKey = publicKey;
        return api.addUser(currentUser.username, result.privateKey, result.publicKey, pass);
      }, function(err){
        throw(err);
      });
    }
    else{
      throw('Username already exists');
    }
  });
}

function getKeys(username, password){
  return api.getDerivationParameters(username).then(function(parameters){
    return derivePassword(password, parameters);
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
  }, function(err){
    throw(err);
  });
}

function refreshKeys(){
  return api.getKeysWithToken(currentUser).then(function(keys){
    currentUser.keys = keys;
    return keys;
  }, function(err){
    throw(err);
  });
}

function addSecret(metadatas, content){
  return new Promise(function(resolve, reject){
    metadatas.users = {};
    metadatas.users[currentUser.username] = {rights: 3};
    if(typeof(currentUser.username) === 'string'){
      return currentUser.createSecret(metadatas, content).then(function(secretObject){
        return api.addSecret(currentUser, secretObject);
      }).then(function(msg){
        resolve(refreshKeys());
      }, function(err){
        throw(err);
      });
    }
    else{
      throw('You are disconnected');
    }
  });
}

function changePassword(password){
  var pass = {};
  return derivePassword(password).then(function(dKey){
    pass.salt = bytesToHexString(dKey.salt);
    pass.hash = bytesToHexString(dKey.hash);
    pass.iterations = dKey.iterations;
    return currentUser.exportPrivateKey(dKey.key);
  }).then(function(privateKey){
    return api.changePassword(currentUser, privateKey, pass);
  }, function(err){
    throw(err);
  });
}

function editSecret(hashedTitle, metadatas, content){
  return currentUser.editSecret(metadatas, content, currentUser.keys[hashedTitle].key).then(function(secretObject){
    return api.editSecret(currentUser, secretObject, hashedTitle);
  }, function(err){
    throw(err);
  });
}

function shareSecret(hashedTitle, friendName, rights){
  var friend = new User(friendName);
  return api.getPublicKey(friend.username).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(sharedSecretObject){
    return api.shareSecret(currentUser, sharedSecretObject, hashedTitle, rights);
  }).then(function(){
    return api.getSecret(hashedTitle, currentUser);
  }).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    currentUser.metadatas[hashedTitle].users[friend.username] = {rights: rights};
    return editSecret(hashedTitle, currentUser.metadatas[hashedTitle], JSON.parse(secret));
  }, function(err){
    throw(err);
  });
}

function unshareSecret(hashedTitle, friendName){
  var friend;
  var encryptedSecret;
  var secret = {};
  var wrappedKeys = [];
  return api.unshareSecret(currentUser, friendName, hashedTitle).then(function(){
    return api.getSecret(hashedTitle, currentUser);
  }).then(function(eSecret){
    encryptedSecret = eSecret;
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    delete currentUser.metadatas[hashedTitle].users[friendName];
    return currentUser.encryptSecret(currentUser.metadatas[hashedTitle], JSON.parse(secret));
  }).then(function(secretObject){
    secret.secret    = secretObject.secret;
    secret.iv        = secretObject.iv;
    secret.metadatas = secretObject.metadatas;
    secret.iv_meta   = secretObject.iv_meta;
    return new Promise(function(resolve, reject){
      encryptedSecret.users.forEach(function(hashedUsername){
        api.getPublicKey(hashedUsername, true).then(function(publicKey){
          friend = new User(hashedUsername);
          return friend.importPublicKey(publicKey);
        }).then(function(){
          return currentUser.wrapKey(secretObject.key, friend.publicKey);
        }).then(function(friendWrappedKey){
          wrappedKeys.push({user: hashedUsername, key: friendWrappedKey });
          if(wrappedKeys.length === encryptedSecret.users.length){
            resolve(api.newKey(currentUser, hashedTitle, secret, wrappedKeys));
          }
        });
      });
    });
  }, function(err){
    throw(err);
  });
}

function getSecret(hashedTitle){
  return api.getSecret(hashedTitle, currentUser).then(function(rEncryptedSecret){
    var encryptedSecret = {secret: rEncryptedSecret.secret, iv: rEncryptedSecret.iv};
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  });
}

function deleteSecret(hashedTitle){
  return api.deleteSecret(currentUser, hashedTitle).then(function(){
    return refreshKeys();
  }, function(err){
    throw(err);
  });
}

function getAllMetadatas(){
  return api.getAllMetadatas(currentUser).then(function(allMetadatas){
    return currentUser.decryptAllMetadatas(allMetadatas);
  }, function(err){
    throw(err);
  })
}