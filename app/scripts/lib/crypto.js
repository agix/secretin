if(typeof(crypto) === 'undefined'){
    crypto = msCrypto;
}
if(typeof(crypto.subtle) === 'undefined'){
    crypto.subtle = crypto.webkitSubtle;
}
// ###################### crypto.js ######################

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


function encryptAESGCM256(secret, key){
  var result = {};
  var algorithm = {};
  if(typeof key === 'undefined'){
    algorithm = {
      name: 'AES-GCM',
      length: 256
    };
    var extractable = true;
    var keyUsages = [
      'encrypt'
    ];
    return crypto.subtle.generateKey(algorithm, extractable, keyUsages).then(function(key){
      var iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      algorithm = {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      };
      var data = asciiToUint8Array(JSON.stringify(secret));
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
    var iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    algorithm = {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    };
    var data = asciiToUint8Array(JSON.stringify(secret));
    result.iv = iv;
    return crypto.subtle.encrypt(algorithm, key, data).then(function(encryptedSecret){
      result.secret = encryptedSecret;
      return result;
    });
  }
}

function decryptAESGCM256(secretObject, key){
  var algorithm = {
    name: 'AES-GCM',
    iv: hexStringToUint8Array(secretObject.iv),
    tagLength: 128
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
    name: 'AES-GCM',
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

function derivePassword(password, parameters){
  var result = {};

  var passwordBuf = asciiToUint8Array(password);
  var extractable = false;
  var usages = ['deriveKey', 'deriveBits'];

  return crypto.subtle.importKey(
    'raw', passwordBuf, {name: 'PBKDF2'}, extractable, usages
  ).then(function(key){

    var saltBuf;
    var iterations;
    if(typeof parameters === 'undefined'){
      saltBuf = new Uint8Array(32);
      crypto.getRandomValues(saltBuf);
      var iterationsBuf = new Uint8Array(1);
      crypto.getRandomValues(iterationsBuf);
      iterations = 100000 + iterationsBuf[0];
    }
    else{
      saltBuf = hexStringToUint8Array(parameters.salt);
      if(typeof parameters.iterations === 'undefined'){
        iterations = 10000; //retrocompatibility
      }
      else{
        iterations = parameters.iterations;
      }
    }

    result.salt = saltBuf;
    result.iterations = iterations;

    var algorithm = {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: iterations,
      hash: {name: "SHA-256"}
    };

    var deriveKeyAlgorithm = {
      name: "AES-CBC",
      length: 256
    };

    extractable = true;
    usages = ['wrapKey', 'unwrapKey'];

    return crypto.subtle.deriveKey(algorithm, key, deriveKeyAlgorithm, extractable, usages);
  }).then(function(dKey){
    result.key = dKey;
    return crypto.subtle.exportKey('raw', dKey);
  }).then(function(rawKey){
    return crypto.subtle.digest('SHA-256', rawKey);
  }).then(function(hashedKey){
    result.hash = hashedKey;
    return result;
  });
}

function exportPrivateKey(key, privateKey){
  var result = {};
  var format = 'jwk';
  var iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  var wrapAlgorithm = {
    name: "AES-CBC",
    iv: iv
  };
  result.iv = iv;
  return crypto.subtle.wrapKey(
    format, privateKey, key, wrapAlgorithm
  ).then(function(wrappedPrivateKey){
    result.privateKey = wrappedPrivateKey;
    return result;
  });
}

function importPrivateKey(key, privateKeyObject){
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
    format, wrappedPrivateKey, key, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages
  ).then(function(privateKey){
    return privateKey;
  }).catch(function(err){
    throw('Invalid Password');
  });
}