var API = function(link) {
  if(link){
    this.db = link;
  }
  else{
    var http = location.protocol;
    var port = location.port;
    var slashes = http.concat("//");
    this.db = slashes.concat(window.location.hostname+':'+port);
  }
};

API.prototype.userExists = function(username){
  return new Promise((resolve, reject) => {
    this.retrieveUser(username).then((user) => {
      resolve(true);
    }, (e) => {
      resolve(false);
    })
  })
}

API.prototype.addUser = function(username, privateKey, publicKey){
  SHA256(username).then((usernameHash) => {
    return POST(this.db+'/user/'+bytesToHexString(usernameHash),
      {
        privateKey: privateKey,
        publicKey: publicKey,
        keys: {}
      }
    )
  })
}

API.prototype.addSecret = function(creator, wrappedKey, iv, encryptedTitle, title, secret){
  return POST(this.db+'/user/'+creator+'/'+title,
    {
      secret: secret,
      iv: iv,
      title: encryptedTitle,
      key: wrappedKey
    }
  )
}

API.prototype.getNewChallenge = function(username){
  return SHA256(username).then((usernameHash) => {
    return GET(this.db+'/token/'+bytesToHexString(usernameHash))
  })
}

API.prototype.shareSecret = function(owner, friend, wrappedKey, encryptedTitle, title, rights){
  var ownerNameHash;
  return SHA256(owner.username).then((pOwnerNameHash) => {
    ownerNameHash = bytesToHexString(pOwnerNameHash);
    return owner.getToken(this, ownerNameHash)
  }).then((token) => {
    return POST(this.db+'/share/'+ownerNameHash+'/'+title,
      {
        friendName: friend,
        title: encryptedTitle,
        key: wrappedKey,
        rights: rights,
        token: bytesToHexString(token)
      }
    )
  })
}

API.prototype.retrieveUser = function(username){
  return SHA256(username).then((usernameHash) => {
    return GET(this.db+'/user/'+bytesToHexString(usernameHash))
  })
}

API.prototype.getWrappedPrivateKey = function(username){
  return new Promise((resolve, reject) => {
    this.retrieveUser(username).then((user) => {
      resolve(user.privateKey)
    }, (e) => {
      reject(e)
    })
  })
}

API.prototype.getPublicKey = function(username){
  return new Promise((resolve, reject) => {
    this.retrieveUser(username).then((user) => {
      resolve(user.publicKey)
    }, (e) => {
      reject(e)
    })
  })
}

API.prototype.getKeys = function(username){
  return new Promise((resolve, reject) => {
    this.retrieveUser(username).then((user) => {
      resolve(user.keys)
    }, (e) => {
      reject(e)
    })
  })
}

API.prototype.getSecret = function(hash){
  return GET(this.db+'/secret/'+hash)
}