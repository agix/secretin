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
  if(typeof this.db.secrets[title] === 'undefined' || typeof this.db.users[creator] === 'undefined'){
    this.db.secrets[title] = {secret: secret, iv: iv, users: [creator]}
    this.db.users[creator].keys[title] = {title: encryptedTitle, key: wrappedKey, right: 2}
    return true;
  }
  else{
    return false;
  }
}


//Should find a way to authenticate the owner
API.prototype.shareKey = function(ownerName, friend, wrappedKey, encryptedTitle, title, right){
  return new Promise((resolve, reject) => {
    SHA256(ownerName).then((ownerNameHash) => {
      var ownerNameHashHex = bytesToHexString(ownerNameHash)
      if(typeof this.db.users[ownerNameHashHex] === 'undefined'){
        reject('Owner doesn\'t exist')
      }else if(typeof this.db.users[ownerNameHashHex].keys[title] === 'undefined' || this.db.users[ownerNameHashHex].keys[title].right < 2){
        reject('You don\'t have right to share this secret')
      }
      else if(typeof this.db.secrets[title] === 'undefined'){
        reject('Secret doesn\'t exist')
      }
      else if(typeof this.db.users[friend] === 'undefined'){
        reject('Friend doesn\'t exist')
      }
      else{
        this.db.secrets[title].users.push(friend)
        this.db.users[friend].keys[title] = {title: encryptedTitle, key: wrappedKey, right: right}
        resolve()
      }
    })
  })
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
  return new Promise((resolve, reject) => {
    if(typeof this.db.secrets[hash] === 'undefined'){
      reject('Invalid secret')
    }
    else{
      resolve(this.db.secrets[hash])
    }
  })
}