
// ###################### User.js ######################

var User = function(username) {
  var _this = this;
  _this.username    = username;
  _this.hash        = null;
  _this.publicKey   = null;
  _this.privateKey  = null;
  _this.keys        = {};
  _this.metadatas   = {};
  _this.token       = {value: '', time: 0};
};

User.prototype.disconnect = function(){
  var _this = this;
  delete _this.username;
  delete _this.hash;
  delete _this.publicKey;
  delete _this.privateKey;
  delete _this.metadatas;
  delete _this.keys;
  delete _this.token;
};

User.prototype.isTokenValid = function(){
  var _this = this;
  return (_this.token.time > Date.now()-10000);
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

User.prototype.exportPrivateKey = function(dKey){
  var _this = this;
  return exportPrivateKey(dKey, _this.privateKey).then(function(privateKeyObject){
    return {
      privateKey: bytesToHexString(privateKeyObject.privateKey),
      iv: bytesToHexString(privateKeyObject.iv)
    };
  });
};

User.prototype.importPrivateKey = function(dKey, privateKeyObject){
  var _this = this;
  return importPrivateKey(dKey, privateKeyObject).then(function(privateKey){
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
  var result = {hashedTitle: hashedTitle};
  return _this.unwrapKey(wrappedKey).then(function(key){
    return _this.wrapKey(key, friend.publicKey);
  }).then(function(friendWrappedKey){
    result.wrappedKey = friendWrappedKey;
    return SHA256(friend.username);
  }).then(function(hashedUsername){
    result.friendName = bytesToHexString(hashedUsername);
    return result;
  });
};

User.prototype.editSecret = function(metadatas, secret, wrappedKey){
  var _this = this;
  var result = {};
  return _this.unwrapKey(wrappedKey).then(function(key){
    return _this.encryptSecret(metadatas, secret, key);
  }).then(function(secretObject){
    result.secret    = secretObject.secret;
    result.iv        = secretObject.iv;
    result.metadatas = secretObject.metadatas;
    result.iv_meta   = secretObject.iv_meta;
    return result;
  });
};

User.prototype.createSecret = function(metadatas, secret){
  var _this = this;
  var now = Date.now();
  var saltedTitle = now+'|'+metadatas.title;
  var result = {};
  return _this.encryptSecret(metadatas, secret).then(function(secretObject){
    result.secret    = secretObject.secret;
    result.iv        = secretObject.iv;
    result.metadatas = secretObject.metadatas;
    result.iv_meta   = secretObject.iv_meta;
    return _this.wrapKey(secretObject.key, _this.publicKey);
  }).then(function(wrappedKey){
    result.wrappedKey = wrappedKey;
    return SHA256(_this.username);
  }).then(function(hashedUsername){
    result.hashedUsername = bytesToHexString(hashedUsername);
    return SHA256(saltedTitle);
  }).then(function(hashedTitle){
    result.hashedTitle = bytesToHexString(hashedTitle);
    return result;
  });
};

User.prototype.encryptSecret = function(metadatas, secret, key){
  var _this = this;
  var result = {};
  return encryptAESGCM256(secret, key).then(function(secretObject){
    result.secret = bytesToHexString(secretObject.secret);
    result.iv     = bytesToHexString(secretObject.iv);
    result.key    = secretObject.key;
    return encryptAESGCM256(metadatas, secretObject.key);
  }).then(function(secretObject){
    result.metadatas = bytesToHexString(secretObject.secret);
    result.iv_meta   = bytesToHexString(secretObject.iv);
    return result;
  });
};

User.prototype.decryptSecret = function(secret, wrappedKey){
  var _this = this;
  return _this.unwrapKey(wrappedKey).then(function(key){
    return decryptAESGCM256(secret, key);
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

User.prototype.decryptAllMetadatas = function(allMetadatas){
  var _this = this;
  var decryptMetadatasPromises = []
  var hashedTitles = Object.keys(_this.keys);
  _this.metadatas = {};
  hashedTitles.forEach(function(hashedTitle){
    decryptMetadatasPromises.push(
      _this.decryptSecret(allMetadatas[hashedTitle], _this.keys[hashedTitle].key).then(function(metadatas){
        _this.metadatas[hashedTitle] = JSON.parse(metadatas);
        return;
      })
    )
  });
  return Promise.all(decryptMetadatasPromises);
}

User.prototype.decryptTitles = function(){ //Should be removed after migration
  var _this = this;
  return new Promise(function(resolve, reject){
    var hashedTitles = Object.keys(_this.keys);
    var total = hashedTitles.length;
    hashedTitles.forEach(function(hashedTitle){
      _this.titles = {};
      if(typeof(_this.keys[hashedTitle].title) !== 'undefined'){
        decryptRSAOAEP(_this.keys[hashedTitle].title, _this.privateKey).then(function(title){
          _this.titles[hashedTitle] = bytesToASCIIString(title);
          if(Object.keys(_this.titles).length === total){
            resolve();
          }
        });
      }
      else{
        total -= 1;
        if(total === 0){
          console.log('Every secrets migrated');
        }
      }
    });
  });
};