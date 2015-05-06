var API = function(link) {
  if(typeof link === 'object'){
    this.db = link
  }
  else{
    this.db = {"users":{}, "secrets": {}};
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
  return new Promise((resolve, reject) => {
    SHA256(username).then((usernameHash) => {
      if(typeof this.db.users[bytesToHexString(usernameHash)] === 'undefined'){
        this.db.users[bytesToHexString(usernameHash)] = {privateKey: privateKey, publicKey: publicKey, keys: {}};
        resolve()
      }
      else{
        reject('User already exists')
      }
    })
  })
}

API.prototype.addSecret = function(creator, wrappedKey, iv, encryptedTitle, title, secret){
  if(typeof this.db.secrets[title] === 'undefined'){
    this.db.secrets[title] = {secret: secret, iv: iv, users: [creator]}
    this.db.users[creator].keys[title] = {title: encryptedTitle, key: wrappedKey, right: 2}
    return true;
  }
  else{
    return false;
  }
}

API.prototype.retrieveUser = function(username){
  return new Promise((resolve, reject) => {
    SHA256(username).then((usernameHash) => {
      if(typeof this.db.users[bytesToHexString(usernameHash)] === 'undefined'){
        reject('Invalid username')
      }
      else{
        resolve(this.db.users[bytesToHexString(usernameHash)])
      }
    })
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
  if(typeof this.db.secrets[hash] === 'undefined'){
    throw('Invalid secret')
  }
  else{
    return this.db.secrets[hash]
  }
}