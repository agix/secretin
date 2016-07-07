
// ###################### util.js ######################

function hexStringToUint8Array(hexString){
  if (hexString.length % 2 !== 0){
    throw "Invalid hexString";
  }
  var arrayBuffer = new Uint8Array(hexString.length / 2);

  for (var i = 0; i < hexString.length; i += 2) {
    var byteValue = parseInt(hexString.substr(i, 2), 16);
    if (isNaN(byteValue)){
      throw "Invalid hexString";
    }
    arrayBuffer[i/2] = byteValue;
  }

  return arrayBuffer;
}

function bytesToHexString(bytes){
  if (!bytes){
    return null;
  }

  bytes = new Uint8Array(bytes);
  var hexBytes = [];

  for (var i = 0; i < bytes.length; ++i) {
    var byteString = bytes[i].toString(16);
    if (byteString.length < 2){
      byteString = "0" + byteString;
    }
    hexBytes.push(byteString);
  }
  return hexBytes.join("");
}

function asciiToUint8Array(str){
  var chars = [];
  for (var i = 0; i < str.length; ++i){
    chars.push(str.charCodeAt(i));
  }
  return new Uint8Array(chars);
}

function bytesToASCIIString(bytes){
  return String.fromCharCode.apply(null, new Uint8Array(bytes));
}

function generateRandomString(length){
  var charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789 !"#$%&\'()*+,-./:;<=>?@[\\]_{}';
  var randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  var string = '';
  for(var i = 0; i < length; i++){
    string += charset[randomValues[i]%charset.length];
  }
  return string;
}
