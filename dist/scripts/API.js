"use strict";

var API = function API(link) {
  if (typeof link === "object") {
    this.db = link;
  } else {
    this.db = { users: {}, secrets: {} };
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

  return new Promise(function (resolve, reject) {
    SHA256(username).then(function (usernameHash) {
      if (typeof _this2.db.users[bytesToHexString(usernameHash)] === "undefined") {
        _this2.db.users[bytesToHexString(usernameHash)] = { privateKey: privateKey, publicKey: publicKey, keys: {} };
        resolve();
      } else {
        reject("User already exists");
      }
    });
  });
};

API.prototype.addSecret = function (creator, wrappedKey, iv, encryptedTitle, title, secret) {
  if (typeof this.db.secrets[title] === "undefined") {
    this.db.secrets[title] = { secret: secret, iv: iv, users: [creator] };
    this.db.users[creator].keys[title] = { title: encryptedTitle, key: wrappedKey, right: 2 };
    return true;
  } else {
    return false;
  }
};

API.prototype.retrieveUser = function (username) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    SHA256(username).then(function (usernameHash) {
      if (typeof _this3.db.users[bytesToHexString(usernameHash)] === "undefined") {
        reject("Invalid username");
      } else {
        resolve(_this3.db.users[bytesToHexString(usernameHash)]);
      }
    });
  });
};

API.prototype.getWrappedPrivateKey = function (username) {
  var _this4 = this;

  return new Promise(function (resolve, reject) {
    _this4.retrieveUser(username).then(function (user) {
      resolve(user.privateKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getPublicKey = function (username) {
  var _this5 = this;

  return new Promise(function (resolve, reject) {
    _this5.retrieveUser(username).then(function (user) {
      resolve(user.publicKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getKeys = function (username) {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    _this6.retrieveUser(username).then(function (user) {
      resolve(user.keys);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getSecret = function (hash) {
  if (typeof this.db.secrets[hash] === "undefined") {
    throw "Invalid secret";
  } else {
    return this.db.secrets[hash];
  }
};