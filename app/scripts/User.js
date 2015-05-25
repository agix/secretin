var User = function(username) {
  this.username   = username
  this.publicKey  = null
  this.privateKey = null
  this.titles     = {}
  this.challenge  = {challenge: '', time: 0}
};

User.prototype.isChallengeValid = function(){
  return (this.challenge.time > Date.now-10)
}

User.prototype.getToken = function(api){
  if(this.isChallengeValid()){
    return decryptRSAOAEP(this.challenge.challenge, this.privateKey)
  }
  else{
    return api.getNewChallenge(this.username).then((challenge) => {
      this.challenge = challenge
      return decryptRSAOAEP(this.challenge.challenge, this.privateKey)
    })
  }

}

User.prototype.generateMasterKey = function(){
    return new Promise((resolve, reject) => {
    genRSAOAEP().then((keyPair) => {
      this.publicKey  = keyPair.publicKey
      this.privateKey = keyPair.privateKey
      resolve()
    })
  })
}

User.prototype.exportPublicKey = function(){
  return crypto.subtle.exportKey('jwk', this.publicKey)
}

User.prototype.importPublicKey = function(jwkPublicKey){
  return new Promise((resolve, reject) => {
    var importAlgorithm = {
      name: "RSA-OAEP",
      hash: {name: "sha-256"}
    }
    crypto.subtle.importKey('jwk', jwkPublicKey, importAlgorithm, false, ['wrapKey', 'encrypt']).then((publicKey) => {
      this.publicKey = publicKey
      resolve()
    })
  })
}

User.prototype.exportPrivateKey = function(password){
  return new Promise((resolve, reject) => {
    var iv = new Uint8Array(16);
    SHA256(password).then((passwordHash) => {
      return crypto.subtle.importKey('raw', passwordHash, {name: 'AES-CBC'}, false, ['wrapKey'])
    }).then((wrappingKey) => {
      crypto.getRandomValues(iv);
      var wrapAlgorithm = {name: "AES-CBC", iv: iv};
      return crypto.subtle.wrapKey('jwk', this.privateKey, wrappingKey, wrapAlgorithm)
    }).then((wrappedPrivateKey) => {
      resolve({iv: bytesToHexString(iv), privateKey: bytesToHexString(wrappedPrivateKey)})
    })
  })
}

User.prototype.importPrivateKey = function(password, jwkPrivateKey){
  return new Promise((resolve, reject) => {
    SHA256(password).then((passwordHash) => {
      return crypto.subtle.importKey('raw', passwordHash, {name: 'AES-CBC'}, false, ['unwrapKey'])
    }).then((wrappingKey) => {
      var unwrappedKeyAlgorithm = {
        name: "RSA-OAEP",
        hash: {name: "sha-256"}
      }
      var unwrapAlgorithm = {name: "AES-CBC", iv: hexStringToUint8Array(jwkPrivateKey.iv)};
      return crypto.subtle.unwrapKey('jwk', hexStringToUint8Array(jwkPrivateKey.privateKey), wrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, false, ['unwrapKey', 'decrypt'])
    }).then((privateKey) => {
      this.privateKey = privateKey
      resolve()
    }, (e) => {
      reject('Invalid password')
    })
  })
}

User.prototype.encryptTitle = function(title, publicKey){
  return new Promise((resolve, reject) => {
    encryptRSAOAEP(title, publicKey).then((encryptedTitle) => {
      resolve(bytesToHexString(encryptedTitle))
    })
  })
}

User.prototype.decryptTitles = function(keys){
  return new Promise((resolve, reject) => {
    var hashes = Object.keys(keys)
    hashes.forEach((hash) => {
      this.titles = {}
      decryptRSAOAEP(keys[hash].title, this.privateKey).then((title) => {
        this.titles[hash] = bytesToASCIIString(title)
        if(Object.keys(this.titles).length === hashes.length){
          resolve()
        }
      })
    })
  })
}

User.prototype.shareSecret = function(friend, wrappedKey, hashTitle){
  return new Promise((resolve, reject) => {
    var result = {};
    this.unwrapKey(wrappedKey).then((key) => {
      return this.wrapKey(key, friend.publicKey, friend.username)
    }).then((rFriendWrappedKey) => {
      result.hashedFriendName = rFriendWrappedKey.username
      result.friendWrappedKey = rFriendWrappedKey.key
      return this.encryptTitle(this.titles[hashTitle], friend.publicKey)
    }).then((encryptedTitle) => {
      result.encryptedTitle = encryptedTitle
      resolve(result)
    })
  })
}

User.prototype.createSecret = function(title, secret){
  return new Promise((resolve, reject) => {
    var now = Date.now()
    var saltedTitle = now+'|'+title
    var result = {}
    this.encryptSecret(saltedTitle, secret).then((secret) => {
      result.hashTitle = secret.title
      result.secret = secret.secret
      result.iv = secret.iv
      return this.wrapKey(secret.key, this.publicKey, this.username)
    }).then((wrappedKey) => {
      result.creator = wrappedKey.username
      result.wrappedKey = wrappedKey.key
      return this.encryptTitle(saltedTitle, this.publicKey)
    }).then((encryptedTitle) => {
      result.encryptedTitle = encryptedTitle
      resolve(result)
    })
  })
}

User.prototype.encryptSecret = function(title, secret){
  return new Promise((resolve, reject) => {
    encryptAESCBC256(secret).then((encryptedSecret) => {
      SHA256(title).then((titleHash) => {
        resolve({
          title:  bytesToHexString(titleHash),
          secret: bytesToHexString(encryptedSecret.secret),
          iv:     bytesToHexString(encryptedSecret.iv),
          key:    encryptedSecret.key
        })
      })
    })
  })
}

User.prototype.decryptSecret = function(secret, wrappedKey){
  return new Promise((resolve, reject) => {
    this.unwrapKey(wrappedKey).then((key) => {
      decryptAESCBC256(secret, key).then((decryptedSecret) => {
        resolve(bytesToASCIIString(decryptedSecret))
      })
    })
  })
}

User.prototype.unwrapKey = function(wrappedKey){
  return unwrapRSAOAEP(wrappedKey, this.privateKey)
}

User.prototype.wrapKey = function(key, publicKey, username){
  return new Promise((resolve, reject) => {
    wrapRSAOAEP(key, publicKey).then((wrappedKey) => {
      SHA256(username).then((usernameHash) => {
        resolve({key: bytesToHexString(wrappedKey), username: bytesToHexString(usernameHash)})
      })
    })
  })
}