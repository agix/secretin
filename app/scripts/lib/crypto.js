function SHA256(str){
  var algorithm = 'SHA-256';
  var data = asciiToUint8Array(str);
  return crypto.subtle.digest(algorithm, data);
}

function genRSAOAEP(){
  var algorithm = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: {name: 'SHA-256'}
  };
  var extractable = true;
  var keyUsages = [
    'wrapKey',
    'unwrapKey',
    'encrypt',
    'decrypt'
  ];
  return crypto.subtle.generateKey(algorithm, extractable, keyUsages);
}

function encryptAESCBC256(secret, key){
  var result = {};
  var algorithm = {};
  if(typeof key === 'undefined'){
    algorithm = {
      name: 'AES-CBC',
      length: 256
    };
    var extractable = true;
    var keyUsages = [
      'encrypt'
    ];
    return crypto.subtle.generateKey(algorithm, extractable, keyUsages).then(function(key){
      var iv = new Uint8Array(32);
      crypto.getRandomValues(iv);
      algorithm = {
        name: 'AES-CBC',
        iv: iv
      };
      var data = asciiToUint8Array(secret);
      result.key = key;
      result.iv = iv;
      return crypto.subtle.encrypt(algorithm, key, data);
    }).then(function(encryptedSecret){
      result.secret = encryptedSecret;
      return result;
    });
  }
  else{
    result.key = key;
    var iv = new Uint8Array(32);
    crypto.getRandomValues(iv);
    algorithm = {
      name: 'AES-CBC',
      iv: iv
    };
    var data = asciiToUint8Array(secret);
    result.iv = iv;
    return crypto.subtle.encrypt(algorithm, key, data).then(function(encryptedSecret){
      result.secret = encryptedSecret;
      return result;
    });
  }
}

function decryptAESCBC256(secretObject, key){
  var algorithm = {
    name: 'AES-CBC',
    iv: hexStringToUint8Array(secretObject.iv)
  };
  var data = hexStringToUint8Array(secretObject.secret);
  return crypto.subtle.decrypt(algorithm, key, data);
}

function encryptRSAOAEP(secret, publicKey){
  var algorithm = {
    name: 'RSA-OAEP',
    hash: {name: 'SHA-256'}
  };
  var data = asciiToUint8Array(secret);
  return crypto.subtle.encrypt(algorithm, publicKey, data);
}

function decryptRSAOAEP(secret, privateKey){
  var algorithm = {
    name: 'RSA-OAEP',
    hash: {name: 'SHA-256'}
  };
  var data = hexStringToUint8Array(secret);
  return crypto.subtle.decrypt(algorithm, privateKey, data);
}

function wrapRSAOAEP(key, wrappingPublicKey){
  var format = 'raw';
  var wrapAlgorithm = {
    name: 'RSA-OAEP',
    hash: {name: 'SHA-256'}
  };
  return crypto.subtle.wrapKey(format, key, wrappingPublicKey, wrapAlgorithm);
}

function unwrapRSAOAEP(wrappedKeyHex, unwrappingPrivateKey){
  var format = 'raw';
  var wrappedKey = hexStringToUint8Array(wrappedKeyHex);
  var unwrapAlgorithm = {
    name: 'RSA-OAEP',
    hash: {name: 'SHA-256'}
  };
  var unwrappedKeyAlgorithm  = {
    name: 'AES-CBC',
    length: 256
  };
  var extractable = true;
  var usages = ['decrypt', 'encrypt'];

  return crypto.subtle.unwrapKey(
    format, wrappedKey, unwrappingPrivateKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, usages
  );
}

function exportPublicKey(publicKey){
  var format = 'jwk';
  return crypto.subtle.exportKey(format, publicKey);
}

function importPublicKey(jwkPublicKey){
  var format = 'jwk';
  var algorithm = {
    name: "RSA-OAEP",
    hash: {name: "SHA-256"}
  };
  var extractable = false;
  var keyUsages = [
    'wrapKey', 'encrypt'
  ];
  return crypto.subtle.importKey(format, jwkPublicKey, algorithm, extractable, keyUsages);
}

function convertToKey(password, salt){
  var saltBuf;

  var algorithm = {
    name: 'PBKDF2'
  };

  var extractable = false;

  var usages = ['deriveBits', 'deriveKey'];

  var passwordBuf = asciiToUint8Array(password);

  return crypto.subtle.importKey('raw', passwordBuf, algorithm, extractable, usages).then(function(key) {
    var params = {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 1000,
      hash: {name: 'SHA-256'}
    };

    var derivedAlgorithm = {
      name: 'AES-CBC',
      length: 256
    };

    if(typeof salt === 'undefined'){
      saltBuf = new Uint8Array(32);
      crypto.getRandomValues(saltBuf);
    }
    else{
      saltBuf = hexStringToUint8Array(salt);
    }

    return crypto.subtle.deriveKey(params, key, derivedAlgorithm, true, ['encrypt', 'decrypt']);
  }).then(function(derivedKey){
    return {
      'key': derivedKey,
      'salt': saltBuf
    }
  });
}

function exportPrivateKey(password, privateKey){
  var format = 'jwk';
  var result = {};
  return convertToKey(password).then(function(wrappingKey){
    var format = 'jwk';
    var iv = new Uint8Array(32);
    crypto.getRandomValues(iv);
    var wrapAlgorithm = {
      name: "AES-CBC",
      iv: iv
    };
    result.iv = iv;
    return crypto.subtle.wrapKey(format, privateKey, wrappingKey.key, wrapAlgorithm);
  }).then(function(wrappedPrivateKey){
    result.privateKey = wrappedPrivateKey;
    result.salt = wrappingKey.salt;
    return result;
  });
}

function importPrivateKey(password, privateKeyObject){
  return convertToKey(password, privateKeyObject.salt).then(function(unwrappingKey){
    var format = 'jwk';
    var wrappedPrivateKey = hexStringToUint8Array(privateKeyObject.privateKey);
    var unwrapAlgorithm = {
      name: 'AES-CBC',
      iv: hexStringToUint8Array(privateKeyObject.iv)
    };
    var unwrappedKeyAlgorithm = {
      name: "RSA-OAEP",
      hash: {name: "sha-256"}
    };
    var extractable = true;
    var keyUsages = ['unwrapKey', 'decrypt'];

    return crypto.subtle.unwrapKey(
      format, wrappedPrivateKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages
    );
  }).then(function(privateKey){
    return privateKey;
  }).catch(function(err){
    throw('Invalid Password');
  });
}