
// ###################### secretin.js ######################

var Secretin = function() {
  this.api = new API();
  this.currentUser = {};
}

Secretin.prototype.changeDB = function(db){
  this.api = new API(db);
}

Secretin.prototype.newUser = function(username, password){
  var _this = this;
  return _this.api.userExists(username).then(function(exists){
    if(!exists){
      var result = {};
      var pass = {};
      _this.currentUser = new User(username);
      return _this.currentUser.generateMasterKey().then(function(){
        return derivePassword(password);
      }).then(function(dKey){
        pass.salt = bytesToHexString(dKey.salt);
        pass.hash = bytesToHexString(dKey.hash);
        pass.iterations = dKey.iterations;
        _this.currentUser.hash = pass.hash;
        return _this.currentUser.exportPrivateKey(dKey.key);
      }).then(function(privateKey){
        result.privateKey = privateKey;
        return _this.currentUser.exportPublicKey();
      }).then(function(publicKey){
        result.publicKey = publicKey;
        return _this.api.addUser(_this.currentUser.username, result.privateKey, result.publicKey, pass);
      }, function(err){
        throw(err);
      });
    }
    else{
      throw('Username already exists');
    }
  });
}

Secretin.prototype.getKeys = function(username, password){
  var _this = this;
  return _this.api.getDerivationParameters(username).then(function(parameters){
    return derivePassword(password, parameters);
  }).then(function(dKey){
    key = dKey.key;
    hash = bytesToHexString(dKey.hash);
    return _this.api.getUser(username, hash);
  }).then(function(user){
    _this.currentUser = new User(username);
    remoteUser = user;
    _this.currentUser.keys = remoteUser.keys;
    _this.currentUser.hash = hash;
    return _this.currentUser.importPublicKey(remoteUser.publicKey);
  }).then(function(){
    return _this.currentUser.importPrivateKey(key, remoteUser.privateKey);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.refreshKeys = function(){
  var _this = this;
  return _this.api.getKeysWithToken(_this.currentUser).then(function(keys){
    _this.currentUser.keys = keys;
    return keys;
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.addSecret = function(metadatas, content){
  var _this = this;
  var hashedTitle;
  return new Promise(function(resolve, reject){
    metadatas.users = {};
    metadatas.folders = {};
    metadatas.users[_this.currentUser.username] = {rights: 2};
    if(typeof(_this.currentUser.username) === 'string'){
      return _this.currentUser.createSecret(metadatas, content).then(function(secretObject){
        hashedTitle = secretObject.hashedTitle
        return _this.api.addSecret(_this.currentUser, secretObject);
      }).then(function(msg){
        return _this.refreshKeys();
      }).then(function(){
        return _this.getAllMetadatas();
      }).then(function(){
        if(typeof(_this.currentUser.currentFolder) !== 'undefined'){
          resolve(_this.addSecretToFolder(hashedTitle, _this.currentUser.metadatas[_this.currentUser.currentFolder].title))
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

Secretin.prototype.changePassword = function(password){
  var _this = this;
  var pass = {};
  return derivePassword(password).then(function(dKey){
    pass.salt = bytesToHexString(dKey.salt);
    pass.hash = bytesToHexString(dKey.hash);
    pass.iterations = dKey.iterations;
    return _this.currentUser.exportPrivateKey(dKey.key);
  }).then(function(privateKey){
    return _this.api.changePassword(_this.currentUser, privateKey, pass);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.editSecret = function(hashedTitle, metadatas, content){
  var _this = this;
  return _this.currentUser.editSecret(metadatas, content, _this.currentUser.keys[hashedTitle].key).then(function(secretObject){
    return _this.api.editSecret(_this.currentUser, secretObject, hashedTitle);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.addSecretToFolder = function(hashedSecretTitle, folderName){
  var _this = this;
  return new Promise(function(resolve, reject){
    var hashedFolder = false;
    Object.keys(_this.currentUser.metadatas).forEach(function(hashedTitle){
      if(typeof(_this.currentUser.metadatas[hashedTitle].type) !== 'undefined' && _this.currentUser.metadatas[hashedTitle].type === 'folder' && _this.currentUser.metadatas[hashedTitle].title === folderName){
        hashedFolder = hashedTitle;
      }
    });
    if(hashedFolder === false){
      reject('Folder not found');
    }
    else{
      var sharedSecretObjectsPromises = [];
      Object.keys(_this.currentUser.metadatas[hashedFolder].users).forEach(function(user){
        if(user !== _this.currentUser.username){
          var friend = new User(user);
          sharedSecretObjectsPromises.push(_this.getSharedSecretObject(hashedSecretTitle, friend, _this.currentUser.metadatas[hashedFolder].users[user].rights));
        }
      });

      return Promise.all(sharedSecretObjectsPromises).then(function(sharedSecretObjects){
        return _this.api.addSecretToFolder(_this.currentUser, sharedSecretObjects, hashedSecretTitle, hashedFolder);
      }).then(function(){
        Object.keys(_this.currentUser.metadatas[hashedFolder].users).forEach(function(user){
          var metaUser = {rights: _this.currentUser.metadatas[hashedFolder].users[user].rights, folder: folderName};
          if(user === _this.currentUser.username){
            metaUser.rights = 2;
          }
          _this.currentUser.metadatas[hashedSecretTitle].users[user] = metaUser;
        });
        _this.currentUser.metadatas[hashedSecretTitle].folders[hashedFolder] = {name: folderName};
        return _this.resetMetadatas(hashedSecretTitle);
      }).then(function(){
        return _this.api.getSecret(hashedFolder, _this.currentUser);
      }).then(function(encryptedSecret){
        return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedFolder].key);
      }).then(function(secret){
        var folder = JSON.parse(secret);
        folder[hashedSecretTitle] = 1;
        resolve(_this.editSecret(hashedFolder, _this.currentUser.metadatas[hashedFolder], folder));
      }, function(err){
        reject(err)
      });
    }
  });
}

Secretin.prototype.getSharedSecretObject = function(hashedTitle, friend, rights){
  var _this = this;
  return _this.api.getPublicKey(friend.username).then(function(publicKey){
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return _this.currentUser.shareSecret(friend, _this.currentUser.keys[hashedTitle].key, hashedTitle);
  }).then(function(secretObject){
    secretObject.rights = rights;
    return secretObject;
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.resetMetadatas = function(hashedTitle){
  var _this = this;
  var secretObject;
  return _this.api.getSecret(hashedTitle, _this.currentUser).then(function(encryptedSecret){
    return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    secretObject = JSON.parse(secret);
    return _this.editSecret(hashedTitle, _this.currentUser.metadatas[hashedTitle], secretObject);
  }).then(function(){
    return secretObject;
  });
}


Secretin.prototype.shareSecret = function(type, hashedTitle, friendName, rights){
  var _this = this;
  if(_this.currentUser.metadatas[hashedTitle].type !== 'folder' && type === 'folder'){
    return _this.addSecretToFolder(hashedTitle, friendName);
  }
  else{
    var friend = new User(friendName);
    return _this.getSharedSecretObject(hashedTitle, friend, rights).then(function(sharedSecretObject){
      return _this.api.shareSecret(_this.currentUser, sharedSecretObject);
    }).then(function(){
      _this.currentUser.metadatas[hashedTitle].users[friend.username] = {rights: rights};
      return _this.resetMetadatas(hashedTitle);
    }).then(function(secretObject){
      if(typeof(_this.currentUser.metadatas[hashedTitle].type) !== 'undefined' && _this.currentUser.metadatas[hashedTitle].type === 'folder'){
        return _this.shareFolderSecrets(Object.keys(secretObject), friend, rights, _this.currentUser.metadatas[hashedTitle].title);
      }
      else{
        return;
      }
    }, function(err){
      throw(err);
    });
  }
}

Secretin.prototype.shareFolderSecrets = function(secretList, friend, rights, folderName){
  var _this = this;
  var shareSecretPromises = [];
  secretList.forEach(function(hashedTitle){
    if(typeof(_this.currentUser.metadatas[hashedTitle]) !== 'undefined'){
      _this.currentUser.metadatas[hashedTitle].users[friend.username] = {rights: rights, folder: folderName};
      shareSecretPromises.push(
        _this.resetMetadatas(hashedTitle).then(function(){
          return _this.currentUser.shareSecret(friend, _this.currentUser.keys[hashedTitle].key, hashedTitle);
        }).then(function(sharedSecretObject){
          sharedSecretObject.rights = rights;
          return sharedSecretObject;
        })
      )
    }
  });
  return Promise.all(shareSecretPromises).then(function(sharedSecretObjects){
    return _this.api.shareMultipleSecrets(_this.currentUser, sharedSecretObjects);
  });
}

Secretin.prototype.unshareSecret = function(hashedTitle, friendName, friendName2){ //friendName2 exists to help migration
  var _this = this;
  var secret = {};
  var isFolder = Promise.resolve();
  if(typeof(_this.currentUser.metadatas[hashedTitle].type) !== 'undefined' && _this.currentUser.metadatas[hashedTitle].type === 'folder'){
    isFolder.then(function(){
      return _this.unshareFolderSecrets(hashedTitle, friendName, friendName2);
    });
  }

  return isFolder.then(function(){
    return _this.api.unshareSecret(_this.currentUser, friendName, hashedTitle, friendName2);
  }).then(function(){
    delete _this.currentUser.metadatas[hashedTitle].users[friendName];
    return _this.renewKey(hashedTitle);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.unshareFolderSecrets = function(hashedFolder, friendName, friendName2){
  var _this = this;
  return _this.api.getSecret(hashedFolder, _this.currentUser).then(function(encryptedSecret){
    return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedFolder].key);
  }).then(function(secrets){
    var unshareSecretPromises = [];
    Object.keys(JSON.parse(secrets)).forEach(function(hashedTitle){
      unshareSecretPromises.push(_this.unshareSecret(hashedTitle, friendName, friendName2));
    });
    return Promise.all(unshareSecretPromises);
  });
}

Secretin.prototype.wrapKeyForFriend = function(hashedUsername, key){
  var _this = this;
  var friend;
  return _this.api.getPublicKey(hashedUsername, true).then(function(publicKey){
    friend = new User(hashedUsername);
    return friend.importPublicKey(publicKey);
  }).then(function(){
    return _this.currentUser.wrapKey(key, friend.publicKey);
  }).then(function(friendWrappedKey){
    return {user: hashedUsername, key: friendWrappedKey };
  });
}

Secretin.prototype.renewKey = function(hashedTitle){
  var _this = this;
  var encryptedSecret;
  var secret = {};
  return _this.api.getSecret(hashedTitle, _this.currentUser).then(function(eSecret){
    encryptedSecret = eSecret;
    return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedTitle].key);
  }).then(function(secret){
    return _this.currentUser.encryptSecret(_this.currentUser.metadatas[hashedTitle], JSON.parse(secret));
  }).then(function(secretObject){
    secret.secret    = secretObject.secret;
    secret.iv        = secretObject.iv;
    secret.metadatas = secretObject.metadatas;
    secret.iv_meta   = secretObject.iv_meta;
    var wrappedKeysPromises = [];
    encryptedSecret.users.forEach(function(hashedUsername){
      wrappedKeysPromises.push(_this.wrapKeyForFriend(hashedUsername, secretObject.key));
    });

    return Promise.all(wrappedKeysPromises);
  }).then(function(wrappedKeys){
    return _this.api.newKey(_this.currentUser, hashedTitle, secret, wrappedKeys);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.removeSecretFromFolder = function(hashedTitle, hashedFolder){
  var _this = this;
  var folderName = _this.currentUser.metadatas[hashedTitle].folders[hashedFolder].name;
  var usersToDelete = [];
  Object.keys(_this.currentUser.metadatas[hashedTitle].users).forEach(function(username){
    var user = _this.currentUser.metadatas[hashedTitle].users[username];
    if(typeof(user.folder) !== 'undefined' && user.folder === folderName){
      usersToDelete.push(username);
    }
  });
  return _this.api.removeSecretFromFolder(_this.currentUser, hashedFolder, usersToDelete, hashedTitle).then(function(){
    usersToDelete.forEach(function(username){
      if(username !== _this.currentUser.username){
        delete _this.currentUser.metadatas[hashedTitle].users[username];
      }
      else{
        delete _this.currentUser.metadatas[hashedTitle].users[username].folder;
      }
    });
    delete _this.currentUser.metadatas[hashedTitle].folders[hashedFolder];
    return _this.renewKey(hashedTitle);
  }).then(function(){
    return _this.api.getSecret(hashedFolder, _this.currentUser);
  }).then(function(encryptedSecret){
    return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedFolder].key);
  }).then(function(secret){
    var folder = JSON.parse(secret);
    delete folder[hashedTitle];
    return _this.editSecret(hashedFolder, _this.currentUser.metadatas[hashedFolder], folder);
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.getSecret = function(hashedTitle){
  var _this = this;
  return _this.api.getSecret(hashedTitle, _this.currentUser).then(function(rEncryptedSecret){
    var encryptedSecret = {secret: rEncryptedSecret.secret, iv: rEncryptedSecret.iv};
    return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedTitle].key);
  });
}

Secretin.prototype.deleteSecret = function(hashedTitle){
  var _this = this;
  delete _this.currentUser.metadatas[hashedTitle].users[_this.currentUser.username];
  return _this.resetMetadatas(hashedTitle).then(function(){
    return _this.api.deleteSecret(_this.currentUser, hashedTitle);
  }).then(function(wasLast){
    if(wasLast){
      var editFolderPromises = [];
      Object.keys(_this.currentUser.metadatas[hashedTitle].folders).forEach(function(hashedFolder){
        editFolderPromises.push(
          _this.api.getSecret(hashedFolder, _this.currentUser).then(function(encryptedSecret){
            return _this.currentUser.decryptSecret(encryptedSecret, _this.currentUser.keys[hashedFolder].key);
          }).then(function(secret){
            var folder = JSON.parse(secret);
            delete folder[hashedTitle];
            return _this.editSecret(hashedFolder, _this.currentUser.metadatas[hashedFolder], folder);
          })
        )
      });
      return Promise.all(editFolderPromises).then(function(){
        return _this.refreshKeys();
      });
    }
    else{
      return _this.refreshKeys();
    }
  }, function(err){
    throw(err);
  });
}

Secretin.prototype.getAllMetadatas = function(){
  var _this = this;
  return _this.api.getAllMetadatas(_this.currentUser).then(function(allMetadatas){
    return _this.currentUser.decryptAllMetadatas(allMetadatas);
  }, function(err){
    throw(err);
  })
}

