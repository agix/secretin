'use strict';

var User = function User(username) {
  this.username = username;
  this.publicKey = null;
  this.privateKey = null;
  this.titles = {};
  this.challenge = { challenge: '', time: 0 };
};

User.prototype.disconnect = function () {
  delete this.username;
  delete this.publicKey;
  delete this.privateKey;
  delete this.titles;
  delete this.challenge;
};

User.prototype.isChallengeValid = function () {
  return this.challenge.time > Date.now - 10;
};

User.prototype.getToken = function (api) {
  var _this = this;

  if (this.isChallengeValid()) {
    return decryptRSAOAEP(this.challenge.challenge, this.privateKey);
  } else {
    return api.getNewChallenge(this.username).then(function (challenge) {
      _this.challenge = challenge;
      return decryptRSAOAEP(_this.challenge.challenge, _this.privateKey);
    });
  }
};

User.prototype.generateMasterKey = function () {
  var _this2 = this;

  return new Promise(function (resolve, reject) {
    genRSAOAEP().then(function (keyPair) {
      _this2.publicKey = keyPair.publicKey;
      _this2.privateKey = keyPair.privateKey;
      resolve();
    });
  });
};

User.prototype.exportPublicKey = function () {
  return crypto.subtle.exportKey('jwk', this.publicKey);
};

User.prototype.importPublicKey = function (jwkPublicKey) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    var importAlgorithm = {
      name: 'RSA-OAEP',
      hash: { name: 'sha-256' }
    };
    crypto.subtle.importKey('jwk', jwkPublicKey, importAlgorithm, false, ['wrapKey', 'encrypt']).then(function (publicKey) {
      _this3.publicKey = publicKey;
      resolve();
    });
  });
};

User.prototype.exportPrivateKey = function (password) {
  var _this4 = this;

  return new Promise(function (resolve, reject) {
    var iv = new Uint8Array(16);
    SHA256(password).then(function (passwordHash) {
      return crypto.subtle.importKey('raw', passwordHash, { name: 'AES-CBC' }, false, ['wrapKey']);
    }).then(function (wrappingKey) {
      crypto.getRandomValues(iv);
      var wrapAlgorithm = { name: 'AES-CBC', iv: iv };
      return crypto.subtle.wrapKey('jwk', _this4.privateKey, wrappingKey, wrapAlgorithm);
    }).then(function (wrappedPrivateKey) {
      resolve({ iv: bytesToHexString(iv), privateKey: bytesToHexString(wrappedPrivateKey) });
    });
  });
};

User.prototype.importPrivateKey = function (password, jwkPrivateKey) {
  var _this5 = this;

  return new Promise(function (resolve, reject) {
    SHA256(password).then(function (passwordHash) {
      return crypto.subtle.importKey('raw', passwordHash, { name: 'AES-CBC' }, false, ['unwrapKey']);
    }).then(function (wrappingKey) {
      var unwrappedKeyAlgorithm = {
        name: 'RSA-OAEP',
        hash: { name: 'sha-256' }
      };
      var unwrapAlgorithm = { name: 'AES-CBC', iv: hexStringToUint8Array(jwkPrivateKey.iv) };
      return crypto.subtle.unwrapKey('jwk', hexStringToUint8Array(jwkPrivateKey.privateKey), wrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, false, ['unwrapKey', 'decrypt']);
    }).then(function (privateKey) {
      _this5.privateKey = privateKey;
      resolve();
    }, function (e) {
      reject('Invalid password');
    });
  });
};

User.prototype.encryptTitle = function (title, publicKey) {
  return new Promise(function (resolve, reject) {
    encryptRSAOAEP(title, publicKey).then(function (encryptedTitle) {
      resolve(bytesToHexString(encryptedTitle));
    });
  });
};

User.prototype.decryptTitles = function (keys) {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    var hashes = Object.keys(keys);
    hashes.forEach(function (hash) {
      _this6.titles = {};
      decryptRSAOAEP(keys[hash].title, _this6.privateKey).then(function (title) {
        _this6.titles[hash] = bytesToASCIIString(title);
        if (Object.keys(_this6.titles).length === hashes.length) {
          resolve();
        }
      });
    });
  });
};

User.prototype.shareSecret = function (friend, wrappedKey, hashTitle) {
  var _this7 = this;

  return new Promise(function (resolve, reject) {
    var result = {};
    _this7.unwrapKey(wrappedKey).then(function (key) {
      return _this7.wrapKey(key, friend.publicKey, friend.username);
    }).then(function (rFriendWrappedKey) {
      result.hashedFriendName = rFriendWrappedKey.username;
      result.friendWrappedKey = rFriendWrappedKey.key;
      return _this7.encryptTitle(_this7.titles[hashTitle], friend.publicKey);
    }).then(function (encryptedTitle) {
      result.encryptedTitle = encryptedTitle;
      resolve(result);
    });
  });
};

User.prototype.createSecret = function (title, secret) {
  var _this8 = this;

  return new Promise(function (resolve, reject) {
    var now = Date.now();
    var saltedTitle = now + '|' + title;
    var result = {};
    _this8.encryptSecret(saltedTitle, secret).then(function (secret) {
      result.hashTitle = secret.title;
      result.secret = secret.secret;
      result.iv = secret.iv;
      return _this8.wrapKey(secret.key, _this8.publicKey, _this8.username);
    }).then(function (wrappedKey) {
      result.creator = wrappedKey.username;
      result.wrappedKey = wrappedKey.key;
      return _this8.encryptTitle(saltedTitle, _this8.publicKey);
    }).then(function (encryptedTitle) {
      result.encryptedTitle = encryptedTitle;
      resolve(result);
    });
  });
};

User.prototype.encryptSecret = function (title, secret) {
  return new Promise(function (resolve, reject) {
    encryptAESCBC256(secret).then(function (encryptedSecret) {
      SHA256(title).then(function (titleHash) {
        resolve({
          title: bytesToHexString(titleHash),
          secret: bytesToHexString(encryptedSecret.secret),
          iv: bytesToHexString(encryptedSecret.iv),
          key: encryptedSecret.key
        });
      });
    });
  });
};

User.prototype.decryptSecret = function (secret, wrappedKey) {
  var _this9 = this;

  return new Promise(function (resolve, reject) {
    _this9.unwrapKey(wrappedKey).then(function (key) {
      decryptAESCBC256(secret, key).then(function (decryptedSecret) {
        resolve(bytesToASCIIString(decryptedSecret));
      });
    });
  });
};

User.prototype.unwrapKey = function (wrappedKey) {
  return unwrapRSAOAEP(wrappedKey, this.privateKey);
};

User.prototype.wrapKey = function (key, publicKey, username) {
  return new Promise(function (resolve, reject) {
    wrapRSAOAEP(key, publicKey).then(function (wrappedKey) {
      SHA256(username).then(function (usernameHash) {
        resolve({ key: bytesToHexString(wrappedKey), username: bytesToHexString(usernameHash) });
      });
    });
  });
};