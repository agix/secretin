"use strict";

var User = function User(username) {
  this.username = username;
  this.publicKey = null;
  this.privateKey = null;
  this.titles = [];
};

User.prototype.generateMasterKey = function () {
  var _this = this;

  return new Promise(function (resolve, reject) {
    genRSAOAEP().then(function (keyPair) {
      _this.publicKey = keyPair.publicKey;
      _this.privateKey = keyPair.privateKey;
      resolve();
    });
  });
};

User.prototype.exportPublicKey = function () {
  return crypto.subtle.exportKey("jwk", this.publicKey);
};

User.prototype.importPublicKey = function (jwkPublicKey) {
  var _this2 = this;

  return new Promise(function (resolve, reject) {
    var importAlgorithm = {
      name: "RSA-OAEP",
      hash: { name: "sha-256" }
    };
    crypto.subtle.importKey("jwk", jwkPublicKey, importAlgorithm, false, ["wrapKey", "encrypt"]).then(function (publicKey) {
      _this2.publicKey = publicKey;
      resolve();
    });
  });
};

User.prototype.exportPrivateKey = function (password) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    var iv = new Uint8Array(16);
    SHA256(password).then(function (passwordHash) {
      return crypto.subtle.importKey("raw", passwordHash, { name: "AES-CBC" }, false, ["wrapKey"]);
    }).then(function (wrappingKey) {
      crypto.getRandomValues(iv);
      var wrapAlgorithm = { name: "AES-CBC", iv: iv };
      return crypto.subtle.wrapKey("jwk", _this3.privateKey, wrappingKey, wrapAlgorithm);
    }).then(function (wrappedPrivateKey) {
      resolve({ iv: bytesToHexString(iv), privateKey: bytesToHexString(wrappedPrivateKey) });
    });
  });
};

User.prototype.importPrivateKey = function (password, jwkPrivateKey) {
  var _this4 = this;

  return new Promise(function (resolve, reject) {
    SHA256(password).then(function (passwordHash) {
      return crypto.subtle.importKey("raw", passwordHash, { name: "AES-CBC" }, false, ["unwrapKey"]);
    }).then(function (wrappingKey) {
      var unwrappedKeyAlgorithm = {
        name: "RSA-OAEP",
        hash: { name: "sha-256" }
      };
      var unwrapAlgorithm = { name: "AES-CBC", iv: hexStringToUint8Array(jwkPrivateKey.iv) };
      return crypto.subtle.unwrapKey("jwk", hexStringToUint8Array(jwkPrivateKey.privateKey), wrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, false, ["unwrapKey", "decrypt"]);
    }).then(function (privateKey) {
      _this4.privateKey = privateKey;
      resolve();
    }, function (e) {
      reject("Invalid password");
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
  var _this5 = this;

  return new Promise(function (resolve, reject) {
    var hashes = Object.keys(keys);
    hashes.forEach(function (hash) {
      _this5.titles = [];
      decryptRSAOAEP(keys[hash].title, _this5.privateKey).then(function (title) {
        _this5.titles.push({ hash: hash, clear: bytesToASCIIString(title) });
        if (_this5.titles.length === hashes.length) {
          resolve();
        }
      });
    });
  });
};

User.prototype.createSecret = function (title, secret) {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    var now = Date.now();
    var saltedTitle = now + "|" + title;
    var result = {};
    _this6.encryptSecret(saltedTitle, secret).then(function (secret) {
      result.hashTitle = secret.title;
      result.secret = secret.secret;
      result.iv = secret.iv;
      return _this6.wrapKey(secret.key, _this6.publicKey, _this6.username);
    }).then(function (wrappedKey) {
      result.creator = wrappedKey.username;
      result.wrappedKey = wrappedKey.key;
      return _this6.encryptTitle(saltedTitle, _this6.publicKey);
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
  var _this7 = this;

  return new Promise(function (resolve, reject) {
    _this7.unwrapKey(wrappedKey).then(function (key) {
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