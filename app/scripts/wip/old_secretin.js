
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
  var hashedTitle;
  return new Promise(function(resolve, reject){
    metadatas.users = {};
    metadatas.folders = {};
    metadatas.users[currentUser.username] = {rights: 2};
    if(typeof(currentUser.username) === 'string'){
      return currentUser.createSecret(metadatas, content).then(function(secretObject){
        hashedTitle = secretObject.hashedTitle
        return api.addSecret(currentUser, secretObject);
      }).then(function(msg){
        return refreshKeys();
      }).then(function(){
        return getAllMetadatas();
      }).then(function(){
        if(typeof(currentUser.currentFolder) !== 'undefined'){
          resolve(addSecretToFolder(hashedTitle, currentUser.metadatas[currentUser.currentFolder].title))
        }
        else{
          resolve();
        }
      }).then(function(){
        resolve();
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

function addSecretToFolder(hashedSecretTitle, folderName){
  return new Promise(function(resolve, reject){
    var hashedFolder = false;
    Object.keys(currentUser.metadatas).forEach(function(hashedTitle){
      if(typeof(currentUser.metadatas[hashedTitle].type) !== 'undefined' && currentUser.metadatas[hashedTitle].type === 'folder' && currentUser.metadatas[hashedTitle].title === folderName){
        hashedFolder = hashedTitle;
      }
    });
    if(hashedFolder === false){
      reject('Folder not found');
    }
    else{
      var sharedSecretObjectsPromises = [];
      Object.keys(currentUser.metadatas[hashedFolder].users).forEach(function(user){
        if(user !== currentUser.username){
          var friend = new User(user);
          sharedSecretObjectsPromises.push(getSharedSecretObject(hashedSecretTitle, friend, currentUser.metadatas[hashedFolder].users[user].rights));
        }
      });

      return Promise.all(sharedSecretObjectsPromises).then(function(sharedSecretObjects){
        return api.addSecretToFolder(currentUser, sharedSecretObjects, hashedSecretTitle, hashedFolder);
      }).then(function(){
        Object.keys(currentUser.metadatas[hashedFolder].users).forEach(function(user){
          var metaUser = {rights: currentUser.metadatas[hashedFolder].users[user].rights, folder: folderName};
          if(user === currentUser.username){
            metaUser.rights = 2;
          }
          currentUser.metadatas[hashedSecretTitle].users[user] = metaUser;
        });
        currentUser.metadatas[hashedSecretTitle].folders[hashedFolder] = {name: folderName};
        return resetMetadatas(hashedSecretTitle);
      }).then(function(){
        return api.getSecret(hashedFolder, currentUser);
      }).then(function(encryptedSecret){
        return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedFolder].key);
      }).then(function(secret){
        var folder = JSON.parse(secret);
        folder[hashedSecretTitle] = 1;
        resolve(editSecret(hashedFolder, currentUser.metadatas[hashedFolder], folder));
      }, function(err){
        reject(err)
      });
    }
  });
}

function getSharedSecretObject(hashedTitle, friend, rights){
  return api.getPublicKey(friend.username).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(secretObject){
    secretObject.rights = rights;
    return secretObject;
  }, function(err){
    throw(err);
  });
}

function resetMetadatas(hashedTitle){
  var secretObject;
  return api.getSecret(hashedTitle, currentUser).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    secretObject = JSON.parse(secret);
    return editSecret(hashedTitle, currentUser.metadatas[hashedTitle], secretObject);
  }).then(function(){
    return secretObject;
  });
}


function shareSecret(hashedTitle, friendName, rights){
  var friend = new User(friendName);
  return getSharedSecretObject(hashedTitle, friend, rights).then(function(sharedSecretObject){
    return api.shareSecret(currentUser, sharedSecretObject);
  }).then(function(){
    currentUser.metadatas[hashedTitle].users[friend.username] = {rights: rights};
    return resetMetadatas(hashedTitle);
  }).then(function(secretObject){
    if(typeof(currentUser.metadatas[hashedTitle].type) !== 'undefined' && currentUser.metadatas[hashedTitle].type === 'folder'){
      return shareFolderSecrets(Object.keys(secretObject), friend, rights, currentUser.metadatas[hashedTitle].title);
    }
    else{
      return;
    }
  }, function(err){
    throw(err);
  });
}

function shareFolderSecrets(secretList, friend, rights, folderName){
  var shareSecretPromises = [];
  secretList.forEach(function(hashedTitle){
    if(typeof(currentUser.metadatas[hashedTitle]) !== 'undefined'){
      currentUser.metadatas[hashedTitle].users[friend.username] = {rights: rights, folder: folderName};
      shareSecretPromises.push(
        resetMetadatas(hashedTitle).then(function(){
          return currentUser.shareSecret(friend, currentUser.keys[hashedTitle].key, hashedTitle);
        }).then(function(sharedSecretObject){
          sharedSecretObject.rights = rights;
          return sharedSecretObject;
        })
      )
    }
  });
  return Promise.all(shareSecretPromises).then(function(sharedSecretObjects){
    return api.shareMultipleSecrets(currentUser, sharedSecretObjects);
  });
}

function unshareSecret(hashedTitle, friendName, friendName2){ //friendName2 exists to help migration
  var secret = {};
  var isFolder = Promise.resolve();
  if(typeof(currentUser.metadatas[hashedTitle].type) !== 'undefined' && currentUser.metadatas[hashedTitle].type === 'folder'){
    isFolder.then(function(){
      return unshareFolderSecrets(hashedTitle, friendName, friendName2);
    });
  }

  return isFolder.then(function(){
    return api.unshareSecret(currentUser, friendName, hashedTitle, friendName2);
  }).then(function(){
    delete currentUser.metadatas[hashedTitle].users[friendName];
    return renewKey(hashedTitle);
  }, function(err){
    throw(err);
  });
}

function unshareFolderSecrets(hashedFolder, friendName, friendName2){
  return api.getSecret(hashedFolder, currentUser).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedFolder].key);
  }).then(function(secrets){
    var unshareSecretPromises = [];
    Object.keys(JSON.parse(secrets)).forEach(function(hashedTitle){
      unshareSecretPromises.push(unshareSecret(hashedTitle, friendName, friendName2));
    });
    return Promise.all(unshareSecretPromises);
  });
}

function wrapKeyForFriend(hashedUsername, key){
  var friend;
  return api.getPublicKey(hashedUsername, true).then(function(publicKey){
    friend = new User(hashedUsername);
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return currentUser.wrapKey(key, friend.publicKey);
  }).then(function(friendWrappedKey){
    return {user: hashedUsername, key: friendWrappedKey };
  });
}

function renewKey(hashedTitle){
  var encryptedSecret;
  var secret = {};
  return api.getSecret(hashedTitle, currentUser).then(function(eSecret){
    encryptedSecret = eSecret;
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    return currentUser.encryptSecret(currentUser.metadatas[hashedTitle], JSON.parse(secret));
  }).then(function(secretObject){
    secret.secret    = secretObject.secret;
    secret.iv        = secretObject.iv;
    secret.metadatas = secretObject.metadatas;
    secret.iv_meta   = secretObject.iv_meta;
    var wrappedKeysPromises = [];
    encryptedSecret.users.forEach(function(hashedUsername){
      wrappedKeysPromises.push(wrapKeyForFriend(hashedUsername, secretObject.key));
    });

    return Promise.all(wrappedKeysPromises);
  }).then(function(wrappedKeys){
    return api.newKey(currentUser, hashedTitle, secret, wrappedKeys);
  }, function(err){
    throw(err);
  });
}

function removeSecretFromFolder(hashedTitle, hashedFolder){
  var folderName = currentUser.metadatas[hashedTitle].folders[hashedFolder].name;
  var usersToDelete = [];
  Object.keys(currentUser.metadatas[hashedTitle].users).forEach(function(username){
    var user = currentUser.metadatas[hashedTitle].users[username];
    if(typeof(user.folder) !== 'undefined' && user.folder === folderName){
      usersToDelete.push(username);
    }
  });
  return api.removeSecretFromFolder(currentUser, hashedFolder, usersToDelete, hashedTitle).then(function(){
    usersToDelete.forEach(function(username){
      if(username !== currentUser.username){
        delete currentUser.metadatas[hashedTitle].users[username];
      }
      else{
        delete currentUser.metadatas[hashedTitle].users[username].folder;
      }
    });
    delete currentUser.metadatas[hashedTitle].folders[hashedFolder];
    return renewKey(hashedTitle);
  }).then(function(){
    return api.getSecret(hashedFolder, currentUser);
  }).then(function(encryptedSecret){
    return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedFolder].key);
  }).then(function(secret){
    var folder = JSON.parse(secret);
    delete folder[hashedTitle];
    return editSecret(hashedFolder, currentUser.metadatas[hashedFolder], folder);
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
  delete currentUser.metadatas[hashedTitle].users[currentUser.username];
  return resetMetadatas(hashedTitle).then(function(){
    return api.deleteSecret(currentUser, hashedTitle);
  }).then(function(wasLast){
    if(wasLast){
      var editFolderPromises = [];
      Object.keys(currentUser.metadatas[hashedTitle].folders).forEach(function(hashedFolder){
        editFolderPromises.push(
          api.getSecret(hashedFolder, currentUser).then(function(encryptedSecret){
            return currentUser.decryptSecret(encryptedSecret, currentUser.keys[hashedFolder].key);
          }).then(function(secret){
            var folder = JSON.parse(secret);
            delete folder[hashedTitle];
            return editSecret(hashedFolder, currentUser.metadatas[hashedFolder], folder);
          })
        )
      });
      return Promise.all(editFolderPromises).then(function(){
        return refreshKeys();
      });
    }
    else{
      return refreshKeys();
    }
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