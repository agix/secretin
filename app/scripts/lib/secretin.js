
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
  return api.getKeys(currentUser.username, currentUser.hash).then(function(keys){
    currentUser.keys = keys;
    return keys;
  }, function(err){
    throw(err);
  });
}

function addSecret(title, content){
  return new Promise(function(resolve, reject){
    if(typeof(currentUser.username) === 'string'){
      return currentUser.createSecret(title, content).then(function(secretObject){
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

function editSecret(hashedTitle, content){
  return currentUser.editSecret(content, currentUser.keys[hashedTitle].key).then(function(secretObject){
    return api.editSecret(currentUser, secretObject, hashedTitle);
  }, function(err){
    throw(err);
  });
}

function getSharedUsers(hashedTitle){
  return api.getSecret(hashedTitle, currentUser).then(function(encryptedSecret){
    return encryptedSecret.users;
  }, function(err){
    throw(err);
  });
}

function shareSecret(hashedTitle, friendName, rights){
  var friend;
  return api.getSecret(hashedTitle, currentUser).then(function(encryptedSecret){
    friend = new User(friendName);
    return api.getPublicKey(friend.username);
  }).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(sharedSecretObject){
    return api.shareSecret(currentUser, sharedSecretObject, hashedTitle, rights);
  }, function(err){
    throw(err);
  });
}

function unshareSecret(hashedTitle, friendName){
  var friend;
  var encryptedSecret;
  var secret = {};
  var wrappedKeys = [];
  return api.unshareSecret(currentUser, friendName, hashedTitle, friendName).then(function(){
    return api.getSecret(hashedTitle, currentUser);
  }).then(function(eSecret){
      encryptedSecret = eSecret;
      return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
      return currentUser.encryptSecret(secret);
  }).then(function(secretObject){
    secret.secret = bytesToHexString(secretObject.secret);
    secret.iv     = bytesToHexString(secretObject.iv);
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
  return api.getSecret(hashedTitle, currentUser).then(function(encryptedSecret){
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
