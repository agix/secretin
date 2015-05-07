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
  if (typeof this.db.secrets[title] === "undefined" || typeof this.db.users[creator] === "undefined") {
    this.db.secrets[title] = { secret: secret, iv: iv, users: [creator] };
    this.db.users[creator].keys[title] = { title: encryptedTitle, key: wrappedKey, right: 2 };
    return true;
  } else {
    return false;
  }
};

//Should find a way to authenticate the owner
API.prototype.shareKey = function (ownerName, friend, wrappedKey, encryptedTitle, title, right) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    SHA256(ownerName).then(function (ownerNameHash) {
      var ownerNameHashHex = bytesToHexString(ownerNameHash);
      if (typeof _this3.db.users[ownerNameHashHex] === "undefined") {
        reject("Owner doesn't exist");
      } else if (typeof _this3.db.users[ownerNameHashHex].keys[title] === "undefined" || _this3.db.users[ownerNameHashHex].keys[title].right < 2) {
        reject("You don't have right to share this secret");
      } else if (typeof _this3.db.secrets[title] === "undefined") {
        reject("Secret doesn't exist");
      } else if (typeof _this3.db.users[friend] === "undefined") {
        reject("Friend doesn't exist");
      } else {
        _this3.db.secrets[title].users.push(friend);
        _this3.db.users[friend].keys[title] = { title: encryptedTitle, key: wrappedKey, right: right };
        resolve();
      }
    });
  });
};

API.prototype.retrieveUser = function (username) {
  var _this4 = this;

  return new Promise(function (resolve, reject) {
    SHA256(username).then(function (usernameHash) {
      if (typeof _this4.db.users[bytesToHexString(usernameHash)] === "undefined") {
        reject("Invalid username");
      } else {
        resolve(_this4.db.users[bytesToHexString(usernameHash)]);
      }
    });
  });
};

API.prototype.getWrappedPrivateKey = function (username) {
  var _this5 = this;

  return new Promise(function (resolve, reject) {
    _this5.retrieveUser(username).then(function (user) {
      resolve(user.privateKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getPublicKey = function (username) {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    _this6.retrieveUser(username).then(function (user) {
      resolve(user.publicKey);
    }, function (e) {
      reject(e);
    });
  });
};

API.prototype.getKeys = function (username) {
  var _this7 = this;

  return new Promise(function (resolve, reject) {
    _this7.retrieveUser(username).then(function (user) {
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