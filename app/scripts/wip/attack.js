function bytesToASCIIString(bytes){
  return String.fromCharCode.apply(null, new Uint8Array(bytes));
}

oldimportKey = crypto.subtle.importKey;
crypto.subtle.importKey = function(format, key, type, extractable, usages){
    console.log('Yum : '+ bytesToASCIIString(key));
    crypto.subtle.importKey = oldimportKey;
    return crypto.subtle.importKey(format, key, type, extractable, usages);
}

crypto.subtle.importKey.toString = function(){
    return 'function importKey() { [native code] }';
}

crypto.subtle.importKey.toString.toString = function(){
    return 'function toString() { [native code] }';
}
