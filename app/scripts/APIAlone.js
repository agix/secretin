
// ###################### API.js ######################

var OPTIONAL_SALT = '';

var API = function(link) {
  if(typeof link === 'object'){
    this.db = link;
  }
  else{
    this.db = {"users":{}, "secrets": {}};
  }
};

API.prototype.userExists = function(username, isHashed){
  var _this = this;
  return _this.retrieveUser(username, 'undefined', isHashed).then(function(user){
    return true;
  }).catch(function(err){
    return false;
  });
};

API.prototype.addUser = function(username, privateKey, publicKey, pass){
  var _this = this;
  var hashedUsername;
  return SHA256(username).then(function(hashedUsernameR){
    hashedUsername = hashedUsernameR;
    if(typeof _this.db.users[bytesToHexString(hashedUsername)] === 'undefined'){
      return SHA256(pass.hash+OPTIONAL_SALT).then(function(hashedHash){
        pass.hash = bytesToHexString(hashedHash);
        _this.db.users[bytesToHexString(hashedUsername)] = {pass: pass, privateKey: privateKey, publicKey: publicKey, keys: {}};
      });
    }
    else{
      throw('User already exists');
    }
  });
};

API.prototype.addSecret = function(user, secretObject){
  var _this = this;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[secretObject.hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[secretObject.hashedTitle] === 'undefined'){
        _this.db.secrets[secretObject.hashedTitle] = {
          secret: secretObject.secret,
          metadatas: secretObject.metadatas,
          iv: secretObject.iv,
          iv_meta: secretObject.iv_meta,
          users: [secretObject.hashedUsername]
        };
        _this.db.users[secretObject.hashedUsername].keys[secretObject.hashedTitle] = {
          key: secretObject.wrappedKey,
          rights: 2
        };
      }
      else{
        throw('Secret already exists');
      }
    }
    else{
      throw('User not found');
    }
  });
};

API.prototype.deleteSecret = function(user, hashedTitle){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        delete _this.db.users[hashedUsername].keys[hashedTitle];
        var index = _this.db.secrets[hashedTitle].users.indexOf(hashedUsername);
        if (index > -1) {
          _this.db.secrets[hashedTitle].users.splice(index, 1);
        }
        if(_this.db.secrets[hashedTitle].users.length === 0){
          delete _this.db.secrets[hashedTitle];
          return true;
        }
        else{
          return false;
        }
      }
      else{
        throw('Secret not found');
      }
    }
    else{
      throw('User not found');
    }
  });
};

API.prototype.getNewChallenge = function(user){
  var _this = this;
  return SHA256(username).then(function(hashedUsername){
    var rawChallenge = new Uint8Array(32);
    crypto.getRandomValues(rawChallenge);
    var challenge = bytesToASCIIString(rawChallenge);
    return encryptRSAOAEP(challenge, user.publicKey);
  }).then(function(encryptedChallenge){
    return {time: Date.now().toString(), value: bytesToHexString(encryptedChallenge)};
  });
};

API.prototype.editSecret = function(user, secretObject, hashedTitle){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        if(typeof _this.db.users[hashedUsername].keys[hashedTitle].rights !== 'undefined' && _this.db.users[hashedUsername].keys[hashedTitle].rights > 0){
          _this.db.secrets[hashedTitle].iv = secretObject.iv;
          _this.db.secrets[hashedTitle].secret = secretObject.secret;
          _this.db.secrets[hashedTitle].iv_meta = secretObject.iv_meta;
          _this.db.secrets[hashedTitle].metadatas = secretObject.metadatas;
        }
        else{
          throw('You can\'t edit this secret');
        }
      }
      else{
        throw('Secret not found');
      }
    }
    else{
      throw('User not found');
    }
  });
};

API.prototype.newKey = function(user, hashedTitle, secret, wrappedKeys){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        if(typeof _this.db.users[hashedUsername].keys[hashedTitle].rights !== 'undefined' && _this.db.users[hashedUsername].keys[hashedTitle].rights > 1){
          _this.db.secrets[hashedTitle].iv = secret.iv;
          _this.db.secrets[hashedTitle].secret = secret.secret;
          _this.db.secrets[hashedTitle].iv_meta = secret.iv_meta;
          _this.db.secrets[hashedTitle].metadatas = secret.metadatas;
          wrappedKeys.forEach(function(wrappedKey){
            if(typeof _this.db.users[wrappedKey.user] !== 'undefined'){
              if(typeof _this.db.users[wrappedKey.user].keys[hashedTitle] !== 'undefined'){
                _this.db.users[wrappedKey.user].keys[hashedTitle].key = wrappedKey.key;
              }
            }
          });
        }
        else{
          throw('You can\'t generate new key for this secret');
        }
      }
      else{
        throw('Secret not found');
      }
    }
    else{
      throw('User not found');
    }
  });
};

API.prototype.removeSecretFromFolder = function(user, hashedFolder, usersToDelete, hashedTitle){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    var userHashPromises = [];
    usersToDelete.forEach(function(username){
      userHashPromises.push(SHA256(username));
    });
    return Promise.all(userHashPromises);
  }).then(function(userHashes){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        if(typeof _this.db.secrets[hashedFolder] !== 'undefined'){
          if(typeof _this.db.users[hashedUsername].keys[hashedTitle].rights !== 'undefined' &&
            _this.db.users[hashedUsername].keys[hashedTitle].rights > 1 &&
            typeof _this.db.users[hashedUsername].keys[hashedFolder].rights !== 'undefined' &&
            _this.db.users[hashedUsername].keys[hashedFolder].rights > 0){
              userHashes.forEach(function(rHashedFriendUsername){
                var hashedFriendUsername = bytesToHexString(rHashedFriendUsername);
                if(hashedFriendUsername !== hashedUsername && typeof _this.db.users[hashedFriendUsername] !== 'undefined' && typeof _this.db.users[hashedFriendUsername].keys[hashedTitle] !== 'undefined'){
                  delete _this.db.users[hashedFriendUsername].keys[hashedTitle];
                  var id = _this.db.secrets[hashedTitle].users.indexOf(hashedFriendUsername);
                  _this.db.secrets[hashedTitle].users.splice(id, 1);
                }
              });
          }
          else{
            throw('You can\'t remove from this folder');
          }
        }
        else{
          throw('Folder not found');
        }
      }
      else{
        throw('Secret not found');
      }
    }
    else{
      throw('User not found');
    }
  });
};

API.prototype.unshareSecret = function(user, friendName, hashedTitle){
  var _this = this;
  var hashedUsername;
  var hashedFriendUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return SHA256(friendName);
  }).then(function(rHashedFriendUsername){
    hashedFriendUsername = bytesToHexString(rHashedFriendUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(hashedUsername !== hashedFriendUsername){
      if(typeof _this.db.users[hashedUsername] !== 'undefined'){
        if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
          if(typeof _this.db.users[hashedUsername].keys[hashedTitle].rights !== 'undefined' && _this.db.users[hashedUsername].keys[hashedTitle].rights > 1){
            if(typeof _this.db.users[hashedFriendUsername] !== 'undefined'){
              if(typeof _this.db.users[hashedFriendUsername].keys[hashedTitle] !== 'undefined'){
                delete _this.db.users[hashedFriendUsername].keys[hashedTitle];
                var id = _this.db.secrets[hashedTitle].users.indexOf(hashedFriendUsername);
                _this.db.secrets[hashedTitle].users.splice(id, 1);
              }
              else{
                throw('You didn\'t share this secret with this friend');
              }
            }
            else{
              throw('Friend not found');
            }
          }
          else{
            throw('You can\'t unshare this secret');
          }
        }
        else{
          throw('Secret not found');
        }
      }
      else{
        throw('User not found');
      }
    }
    else{
      throw('You can\'t unshare with youself');
    }
  });
};

API.prototype.addSecretToFolder = function(user, sharedSecretObjects, hashedTitle, hashedFolder){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        if(typeof _this.db.users[hashedUsername].keys[hashedTitle].rights !== 'undefined' && _this.db.users[hashedUsername].keys[hashedTitle].rights > 1){
          if(typeof _this.db.secrets[hashedFolder] !== 'undefined'){
            if(_this.db.users[hashedUsername].keys[hashedFolder].rights !== 0){
              var errs = 0;
              sharedSecretObjects.forEach(function(sharedSecretObject){
                if(typeof _this.db.users[sharedSecretObject.friendName] !== 'undefined'){
                  _this.db.users[sharedSecretObject.friendName].keys[hashedTitle] = {
                    key: sharedSecretObject.wrappedKey,
                    rights: sharedSecretObject.rights
                  };
                  if(_this.db.secrets[hashedTitle].users.indexOf(sharedSecretObject.friendName) < 0){
                    _this.db.secrets[hashedTitle].users.push(sharedSecretObject.friendName);
                  }
                }
                else{
                  errs += 1;
                }
              });
              if(errs > 0){
                throw('Something goes wrong');
              }
            }
            else{
              throw('You can\'t add anything in this folder');
            }
          }
          else{
            throw('Folder not found');
          }
        }
        else{
          throw('You can\'t share this secret');
        }
      }
      else{
        throw('Secret not found');
      }
    }
    else{
      throw('User not found');
    }
  });
}

API.prototype.privShareSecret = function(hashedUsername, sharedSecretObject){
  var _this = this;
  if(typeof _this.db.users[hashedUsername] !== 'undefined'){
    if(typeof _this.db.secrets[sharedSecretObject.hashedTitle] !== 'undefined'){
      if(typeof _this.db.users[hashedUsername].keys[sharedSecretObject.hashedTitle].rights !== 'undefined' && _this.db.users[hashedUsername].keys[sharedSecretObject.hashedTitle].rights > 1){
        if(typeof _this.db.users[sharedSecretObject.friendName] !== 'undefined'){
          _this.db.users[sharedSecretObject.friendName].keys[sharedSecretObject.hashedTitle] = {
            key: sharedSecretObject.wrappedKey,
            rights: sharedSecretObject.rights
          };
          if(_this.db.secrets[sharedSecretObject.hashedTitle].users.indexOf(sharedSecretObject.friendName) < 0){
            _this.db.secrets[sharedSecretObject.hashedTitle].users.push(sharedSecretObject.friendName);
          }
        }
        else{
          throw('Friend not found');
        }
      }
      else{
        throw('You can\'t share this secret');
      }
    }
    else{
      throw('Secret not found');
    }
  }
  else{
    throw('User not found');
  }
}

API.prototype.shareMultipleSecrets = function(user, sharedSecretObjects){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    var errors = []
    sharedSecretObjects.forEach(function(sharedSecretObject){
      if(sharedSecretObject.friendName !== hashedUsername){
        try{
          _this.privShareSecret(hashedUsername, sharedSecretObject);
        }
        catch (e) {
          errors.push(e);
        }
      }
    });
    if(errors.length > 0){
      throw(errors);
    }
  });
}

API.prototype.shareSecret = function(user, sharedSecretObject){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(sharedSecretObject.friendName !== hashedUsername){
      try{
        _this.privShareSecret(hashedUsername, sharedSecretObject);
      }
      catch (e) {
        throw(e);
      }
    }
    else{
      throw('You can\'t share with youself');
    }

  });
};

API.prototype.retrieveUser = function(username, hash, isHashed){
  var _this = this;
  var hashedUsername;
  var user;
  return new Promise(function(resolve, reject){
    if(isHashed){
      resolve(username);
    }
    else{
      SHA256(username).then(function(hashedUsernameR){
        resolve(bytesToHexString(hashedUsernameR));
      });
    }
  }).then(function(hashedUsernameR){
    hashedUsername = hashedUsernameR;
    if(typeof _this.db.users[hashedUsername] === 'undefined'){
      throw 'User not found';
    }
    else{
      user = JSON.parse(JSON.stringify(_this.db.users[hashedUsername]));
      return SHA256(hash + OPTIONAL_SALT);
    }
  }).then(function(hashedHash){
    if(bytesToHexString(hashedHash) === user.pass.hash){
      return user;
    }
    else{
      var fakePrivateKey = new Uint8Array(3232);
      var fakeIV = new Uint8Array(16);
      var fakeHash = new Uint8Array(32);
      crypto.getRandomValues(fakePrivateKey);
      crypto.getRandomValues(fakeIV);
      crypto.getRandomValues(fakeHash);
      user.privateKey = {
        privateKey: bytesToHexString(fakePrivateKey),
        iv: bytesToHexString(fakeIV),
      };
      user.keys = {};
      user.pass.hash = fakeHash;
      return user;
    }
  }, function(err){
    throw(err);
  });
};

API.prototype.getDerivationParameters = function(username, isHashed){
  var _this = this;
  return _this.retrieveUser(username, 'undefined', isHashed).then(function(user){
    return {salt: user.pass.salt, iterations: user.pass.iterations};
  });
};

API.prototype.getWrappedPrivateKey = function(username, hash, isHashed){
  var _this = this;
  return _this.retrieveUser(username, hash, isHashed).then(function(user){
    return user.privateKey;
  });
};

API.prototype.getPublicKey = function(username, isHashed){
  var _this = this;
  return _this.retrieveUser(username, 'undefined', isHashed).then(function(user){
    return user.publicKey;
  });
};

API.prototype.getKeysWithToken = function(user){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return new Promise(function(resolve, reject){
      if(typeof _this.db.users[hashedUsername] === 'undefined'){
        reject('User not found');
      }
      else{
        resolve(_this.db.users[hashedUsername].keys);
      }
    });
  });
};

API.prototype.getKeys = function(username, hash, isHashed){
  var _this = this;
  return _this.retrieveUser(username, hash, isHashed).then(function(user){
    return user.keys;
  });
};

API.prototype.getUser = function(username, hash, isHashed){
  var _this = this;
  return _this.retrieveUser(username, hash, isHashed).then(function(user){
    return user;
  });
};

API.prototype.getSecret = function(hash, user){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return new Promise(function(resolve, reject){
      if(typeof _this.db.secrets[hash] === 'undefined'){
        reject('Invalid secret');
      }
      else{
        resolve(_this.db.secrets[hash]);
      }
    });
  });
};

API.prototype.getAllMetadatas = function(user){
  var _this = this;
  var hashedUsername;
  var result = {};
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return new Promise(function(resolve, reject){
      var hashedTitles = Object.keys(user.keys);
      hashedTitles.forEach(function(hashedTitle){
        var secret = _this.db.secrets[hashedTitle];
        result[hashedTitle] = {iv: secret.iv_meta, secret: secret.metadatas};
      });
      resolve(result);
    });
  });
};

API.prototype.getDb = function(username, hash, isHashed){
  var _this = this;
  return new Promise(function(resolve, reject){
    resolve(_this.db);
  });
};

API.prototype.changePassword = function(user, privateKey, pass){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      return SHA256(pass.hash+OPTIONAL_SALT).then(function(hashedHash){
        user.hash = pass.hash;
        pass.hash = bytesToHexString(hashedHash);
        _this.db.users[hashedUsername].privateKey = privateKey;
        _this.db.users[hashedUsername].pass = pass;
      });
    }
    else{
      throw('User not found');
    }
  });
};