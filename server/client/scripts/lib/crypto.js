'use strict';

function SHA256(str) {
  return crypto.subtle.digest('SHA-256', asciiToUint8Array(str));
}

function genRSAOAEP() {
  var rsaOaep = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: { name: 'SHA-256' }
  };
  return crypto.subtle.generateKey(rsaOaep, true, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
}

function encryptAESCBC256(secret) {
  return new Promise(function (resolve, reject) {
    crypto.subtle.generateKey({ name: 'AES-CBC', length: 256 }, true, ['encrypt']).then(function (key) {
      var iv = new Uint8Array(16);
      crypto.getRandomValues(iv);
      var algorithm = { name: 'AES-CBC', iv: iv };
      crypto.subtle.encrypt(algorithm, key, asciiToUint8Array(secret)).then(function (encryptedSecret) {
        resolve({ secret: encryptedSecret, key: key, iv: iv });
      });
    });
  });
}

function decryptAESCBC256(secret, key) {
  var algorithm = { name: 'AES-CBC', iv: hexStringToUint8Array(secret.iv) };
  return crypto.subtle.decrypt(algorithm, key, hexStringToUint8Array(secret.secret));
}

function encryptRSAOAEP(secret, publicKey) {
  return crypto.subtle.encrypt({ name: 'RSA-OAEP', hash: { name: 'SHA-256' } }, publicKey, asciiToUint8Array(secret));
}

function decryptRSAOAEP(secret, privateKey) {
  return crypto.subtle.decrypt({ name: 'RSA-OAEP', hash: { name: 'SHA-256' } }, privateKey, hexStringToUint8Array(secret));
}

function wrapRSAOAEP(key, publicKey) {
  return crypto.subtle.wrapKey('raw', key, publicKey, { name: 'RSA-OAEP', hash: { name: 'SHA-256' } });
}

function unwrapRSAOAEP(wrappedKeyHex, privateKey) {
  var wrappingAlgorithm = { name: 'RSA-OAEP', hash: { name: 'SHA-256' } };
  var wrappedAlgorithm = { name: 'AES-CBC', length: 256 };
  var usages = ['decrypt', 'encrypt'];
  var wrappedKey = hexStringToUint8Array(wrappedKeyHex);
  return crypto.subtle.unwrapKey('raw', wrappedKey, privateKey, wrappingAlgorithm, wrappedAlgorithm, true, usages);
}