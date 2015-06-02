var User = function(username) {
  var _this = this;
  _this.username    = username;
  _this.publicKey   = null;
  _this.privateKey  = null;
  _this.keys        = {};
  _this.titles      = {};
  _this.token       = {value: '', time: 0};
};

User.prototype.disconnect = function(){
  var _this = this;
  delete _this.username;
  delete _this.publicKey;
  delete _this.privateKey;
  delete _this.titles;
  delete _this.challenge;
};

User.prototype.isTokenValid = function(){
  var _this = this;
  return (_this.token.time > Date.now-10);
};

User.prototype.getToken = function(api){
  var _this = this;
  if(_this.isTokenValid()){
    return _this.token.value;
  }
  else{
    return api.getNewChallenge(_this).then(function(challenge){
      _this.token.time  = challenge.time;
      _this.token.value = decryptRSAOAEP(challenge.value, _this.privateKey);
      return _this.token.value;
    });
  }
};

User.prototype.generateMasterKey = function(){
  var _this = this;
  return genRSAOAEP().then(function(keyPair) {
    _this.publicKey  = keyPair.publicKey;
    _this.privateKey = keyPair.privateKey;
  });
};

User.prototype.exportPublicKey = function(){
  var _this = this;
  return exportPublicKey(_this.publicKey);
};

User.prototype.importPublicKey = function(jwkPublicKey){
  var _this = this;
  return importPublicKey(jwkPublicKey).then(function(publicKey){
    _this.publicKey = publicKey;
  });
};

User.prototype.exportPrivateKey = function(password){
  var _this = this;
  return exportPrivateKey(password, _this.privateKey).then(function(privateKeyObject){
    return {
      privateKey: bytesToHexString(privateKeyObject.privateKey),
      iv: bytesToHexString(privateKeyObject.iv)
    };
  });
};

User.prototype.importPrivateKey = function(password, privateKeyObject){
  var _this = this;
  return importPrivateKey(password, privateKeyObject).then(function(privateKey){
    _this.privateKey = privateKey;
  });
};

User.prototype.encryptTitle = function(title, publicKey){
  var _this = this;
  return encryptRSAOAEP(title, publicKey).then(function(encryptedTitle){
    return bytesToHexString(encryptedTitle);
  });
};

User.prototype.shareSecret = function(friend, wrappedKey, hashedTitle){
  var _this = this;
  var result = {};
  return _this.unwrapKey(wrappedKey).then(function(key){
    return _this.wrapKey(key, friend.publicKey);
  }).then(function(friendWrappedKey){
    result.wrappedKey = friendWrappedKey;
    return _this.encryptTitle(_this.titles[hashedTitle], friend.publicKey);
  }).then(function(encryptedTitle){
    result.encryptedTitle = encryptedTitle;
    return SHA256(friend.username);
  }).then(function(hashedUsername){
    result.friendName = bytesToHexString(hashedUsername);
    return result;
  });
};

User.prototype.editSecret = function(secret, wrappedKey){
  var _this = this;
  var result = {};
  return _this.unwrapKey(wrappedKey).then(function(key){
    return encryptAESCBC256(secret, key);
  }).then(function(secretObject){
    result.secret = bytesToHexString(secretObject.secret);
    result.iv = bytesToHexString(secretObject.iv);
    return result;
  });
}

User.prototype.createSecret = function(title, secret){
  var _this = this;
  var now = Date.now();
  var saltedTitle = now+'|'+title;
  var result = {};
  return _this.encryptSecret(secret).then(function(secretObject){
    result.secret = bytesToHexString(secretObject.secret);
    result.iv = bytesToHexString(secretObject.iv);
    return _this.wrapKey(secretObject.key, _this.publicKey);
  }).then(function(wrappedKey){
    result.wrappedKey = wrappedKey;
    return _this.encryptTitle(saltedTitle, _this.publicKey);
  }).then(function(encryptedTitle){
    result.encryptedTitle = encryptedTitle;
    return SHA256(_this.username);
  }).then(function(hashedUsername){
    result.hashedUsername = bytesToHexString(hashedUsername);
    return SHA256(saltedTitle);
  }).then(function(hashedTitle){
    result.hashedTitle = bytesToHexString(hashedTitle);
    return result;
  });
};

User.prototype.encryptSecret = function(secret){
  var _this = this;
  return encryptAESCBC256(secret);
};

User.prototype.decryptSecret = function(secret, wrappedKey){
  var _this = this;
  return _this.unwrapKey(wrappedKey).then(function(key){
    return decryptAESCBC256(secret, key);
  }).then(function(decryptedSecret){
    return bytesToASCIIString(decryptedSecret);
  });
};

User.prototype.unwrapKey = function(wrappedKey){
  var _this = this;
  return unwrapRSAOAEP(wrappedKey, _this.privateKey);
};

User.prototype.wrapKey = function(key, publicKey){
  var _this = this;
  return wrapRSAOAEP(key, publicKey).then(function(wrappedKey){
    return bytesToHexString(wrappedKey);
  });
};

User.prototype.decryptTitles = function(){
  var _this = this;
  return new Promise(function(resolve, reject){
    var hashedTitles = Object.keys(_this.keys);
    hashedTitles.forEach(function(hashedTitle){
      _this.titles = {};
      decryptRSAOAEP(_this.keys[hashedTitle].title, _this.privateKey).then(function(title){
        _this.titles[hashedTitle] = bytesToASCIIString(title);
        if(Object.keys(_this.titles).length === hashedTitles.length){
          resolve();
        }
      });
    });
  });
};