var API = function(link, textarea) {
  if(typeof link === 'object'){
    this.db = link;
  }
  else{
    this.db = {"users":{}, "secrets": {}};
  }
  this.textarea = textarea;
};

API.prototype.userExists = function(username){
  var _this = this;
  return _this.retrieveUser(username).then(function(user){
    return true;
  }).catch(function(err){
    return false;
  });
};

API.prototype.addUser = function(username, privateKey, publicKey){
  var _this = this;
  return SHA256(username).then(function(hashedUsername){
    if(typeof _this.db.users[bytesToHexString(hashedUsername)] === 'undefined'){
      _this.db.users[bytesToHexString(hashedUsername)] = {privateKey: privateKey, publicKey: publicKey, keys: {}};
      _this.textarea.value = JSON.stringify(_this.db);
    }
    else{
      throw('User already exists');
    }
  });
};

API.prototype.addSecret = function(secretObject){
  var _this = this;
  return new Promise(function(resolve, reject){
    if(typeof _this.db.users[secretObject.hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[secretObject.hashedTitle] === 'undefined'){
        _this.db.secrets[secretObject.hashedTitle] = {
          secret: secretObject.secret,
          iv: secretObject.iv,
          users: [secretObject.hashedUsername]
        }
        _this.db.users[secretObject.hashedUsername].keys[secretObject.hashedTitle] = {
          title: secretObject.encryptedTitle,
          key: secretObject.wrappedKey,
          right: 2
        }
        _this.textarea.value = JSON.stringify(_this.db);
        resolve();
      }
      else{
        reject('Secret already exists');
      }
    }
    else{
      reject('User not found');
    }
  });
}

API.prototype.deleteSecret = function(user, hashedTitle){
  var _this = this;
  var hashdeUsername;
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
        }
        _this.textarea.value = JSON.stringify(_this.db);
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
  var hashdeUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        _this.db.secrets[hashedTitle].iv = secretObject.iv;
        _this.db.secrets[hashedTitle].secret = secretObject.secret;
        _this.textarea.value = JSON.stringify(_this.db);
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

API.prototype.shareSecret = function(user, sharedSecretObject, hashedTitle, rights){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    if(typeof _this.db.users[hashedUsername] !== 'undefined'){
      if(typeof _this.db.secrets[hashedTitle] !== 'undefined'){
        if(typeof _this.db.users[sharedSecretObject.friendName] !== 'undefined'){
          _this.db.users[sharedSecretObject.friendName].keys[hashedTitle] = {
            title: sharedSecretObject.encryptedTitle,
            key: sharedSecretObject.wrappedKey,
            rights: rights
          }
          if(_this.db.secrets[hashedTitle].users.indexOf(sharedSecretObject.friendName) < 0){
            _this.db.secrets[hashedTitle].users.push(sharedSecretObject.friendName);
          }
          _this.textarea.value = JSON.stringify(_this.db);
        }
        else{
          throw('Friend not found');
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

API.prototype.retrieveUser = function(username){
  var _this = this;
  return SHA256(username).then(function(hashedUsername){
    if(typeof _this.db.users[bytesToHexString(hashedUsername)] === 'undefined'){
      throw 'User not found';
    }
    else{
      return _this.db.users[bytesToHexString(hashedUsername)];
    }
  });
};

API.prototype.getWrappedPrivateKey = function(username){
  var _this = this;
  return _this.retrieveUser(username).then(function(user){
    return user.privateKey;
  });
};

API.prototype.getPublicKey = function(username){
  var _this = this;
  return _this.retrieveUser(username).then(function(user){
    return user.publicKey;
  });
};

API.prototype.getKeys = function(username){
  var _this = this;
  return _this.retrieveUser(username).then(function(user){
    return user.keys;
  });
};

API.prototype.getUser = function(username){
  var _this = this;
  return _this.retrieveUser(username).then(function(user){
    return user;
  });
};

API.prototype.getSecret = function(hash){
  var _this = this;
  return new Promise(function(resolve, reject){
    if(typeof _this.db.secrets[hash] === 'undefined'){
      reject('Invalid secret')
    }
    else{
      resolve(_this.db.secrets[hash])
    }
  })
}