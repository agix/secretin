
// ###################### API.js ######################

var API = function(link) {
  var _this = this;
  if(link){
    _this.db = link;
  }
  else{
    _this.db = window.location.origin;
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
  return SHA256(username).then(function(hashedUsername){
    return POST(_this.db+'/user/'+bytesToHexString(hashedUsername),{
      pass: pass,
      privateKey: privateKey,
      publicKey: publicKey,
      keys: {}
    });
  });
};

API.prototype.addSecret = function(user, secretObject){
  var _this = this;
  return user.getToken(_this).then(function(token){
    return POST(_this.db+'/user/'+secretObject.hashedUsername+'/'+secretObject.hashedTitle,{
      secret: secretObject.secret,
      iv: secretObject.iv,
      metadatas: secretObject.metadatas,
      iv_meta: secretObject.iv_meta,
      key: secretObject.wrappedKey,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.deleteSecret = function(user, hashedTitle){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return DELETE(_this.db+'/user/'+hashedUsername+'/'+hashedTitle, {
      token: bytesToHexString(token)
    });
  }).then(function(datas){
    return datas;
  });
};


API.prototype.getNewChallenge = function(user){
  var _this = this;
  return SHA256(user.username).then(function(hashedUsername){
    return GET(_this.db+'/challenge/'+bytesToHexString(hashedUsername));
  });
};

API.prototype.editSecret = function(user, secretObject, hashedTitle){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return POST(_this.db+'/edit/'+hashedUsername+'/'+hashedTitle,{
      iv: secretObject.iv,
      secret: secretObject.secret,
      iv_meta: secretObject.iv_meta,
      metadatas: secretObject.metadatas,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.newKey = function(user, hashedTitle, secret, wrappedKeys){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return POST(_this.db+'/newKey/'+hashedUsername+'/'+hashedTitle,{
      wrappedKeys: wrappedKeys,
      secret: secret,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.unshareSecret = function(user, friendNames, hashedTitle){
  var _this = this;
  var hashedUsername;
  var hashedFriendUserames = [];
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    var hashedFriendUseramePromises = [];
    friendNames.forEach(function(username){
      hashedFriendUseramePromises.push(SHA256(username));
    });
    return Promise.all(hashedFriendUseramePromises);
  }).then(function(rHashedFriendUserames){
    rHashedFriendUserames.forEach(function(hashedFriendUserame){
      hashedFriendUserames.push(bytesToHexString(hashedFriendUserame));
    });
    return user.getToken(_this);
  }).then(function(token){
    return POST(_this.db+'/unshare/'+hashedUsername+'/'+hashedTitle,{
      friendNames: hashedFriendUserames,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.shareSecret = function(user, sharedSecretObjects){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return POST(_this.db+'/share/'+hashedUsername,{
      secretObjects: sharedSecretObjects,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.retrieveUser = function(username, hash, isHashed){
  var _this = this;
  if(isHashed){
    return GET(_this.db+'/user/'+username+'/'+hash);
  }
  else{
    return SHA256(username).then(function(hashedUsername){
      return GET(_this.db+'/user/'+bytesToHexString(hashedUsername)+'/'+hash);
    });
  }
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
    return GET(_this.db+'/user/'+hashedUsername+'?token='+bytesToHexString(token));
  }).then(function(userContent){
    return userContent.keys;
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

API.prototype.getSecret = function(hashedTitle, user){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return GET(_this.db+'/secret/'+hashedTitle+'?name='+hashedUsername+'&token='+bytesToHexString(token));
  });
};

API.prototype.getAllMetadatas = function(user){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return GET(_this.db+'/allMetadatas/'+hashedUsername+'?token='+bytesToHexString(token));
  }).then(function(datas){
    return datas
  });
};

API.prototype.getDb = function(username, hash, isHashed){
  var _this = this;
  return SHA256(username).then(function(hashedUsername){
    return GET(_this.db+'/database/'+bytesToHexString(hashedUsername)+'/'+hash);
  });
};

API.prototype.changePassword = function(user, privateKey, pass){
  var _this = this;
  var hashedUsername;
  return SHA256(user.username).then(function(rHashedUsername){
    hashedUsername = bytesToHexString(rHashedUsername);
    return user.getToken(_this);
  }).then(function(token){
    return PUT(_this.db+'/user/'+hashedUsername,{
      pass: pass,
      privateKey: privateKey,
      token: bytesToHexString(token)
    });
  });
};