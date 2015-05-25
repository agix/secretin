'use strict';

var API = function API(link) {
  if (link) {
    this.db = link;
  } else {
    var http = location.protocol;
    var port = location.port;
    var slashes = http.concat('//');
    this.db = slashes.concat(window.location.hostname + ':' + port);
  }
};

API.prototype.userExists = function (username) {
  var _this = this;

  return new Promise(function (resolve, reject) {
    _this.retrieveUser(username).then(function (user) {
      resolve(true);
    }, function (e) {
      resolve(false);
    });
  });
};

API.prototype.addUser = function (username, privateKey, publicKey) {
  var _this2 = this;

  SHA256(username).then(function (usernameHash) {
    return POST(_this2.db + '/user/' + bytesToHexString(usernameHash), {
      privateKey: privateKey,
      publicKey: publicKey,
      keys: {}
    });
  });
};

API.prototype.addSecret = function (creator, wrappedKey, iv, encryptedTitle, title, secret) {
  return POST(this.db + '/user/' + creator + '/' + title, {
    secret: secret,
    iv: iv,
    title: encryptedTitle,
    key: wrappedKey
  });
};

API.prototype.getNewChallenge = function (username) {
  var _this3 = this;

  return SHA256(username).then(function (usernameHash) {
    return GET(_this3.db + '/token/' + bytesToHexString(usernameHash));
  });
};

API.prototype.shareSecret = function (owner, friend, wrappedKey, encryptedTitle, title, rights) {
  var _this4 = this;

  var ownerNameHash;
  return SHA256(owner.username).then(function (pOwnerNameHash) {
    ownerNameHash = bytesToHexString(pOwnerNameHash);
    return owner.getToken(_this4, ownerNameHash);
  }).then(function (token) {
    return POST(_this4.db + '/share/' + ownerNameHash + '/' + title, {
      friendName: friend,
      title: encryptedTitle,
      key: wrappedKey,
      rights: rights,
      token: bytesToHexString(token)
    });
  });
};

API.prototype.retrieveUser = function (username) {
  var _this5 = this;

  return SHA256(username).then(function (usernameHash) {
    return GET(_this5.db + '/user/' + bytesToHexString(usernameHash));
  });
};

API.prototype.getWrappedPrivateKey = function (username) {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    _this6.retrieveUser(username).then(function (user) {
      resolve(user.privateKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getPublicKey = function (username) {
  var _this7 = this;

  return new Promise(function (resolve, reject) {
    _this7.retrieveUser(username).then(function (user) {
      resolve(user.publicKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getKeys = function (username) {
  var _this8 = this;

  return new Promise(function (resolve, reject) {
    _this8.retrieveUser(username).then(function (user) {
      resolve(user.keys);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getSecret = function (hash) {
  return GET(this.db + '/secret/' + hash);
};