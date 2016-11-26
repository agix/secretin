var express = require('express');
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var _ = require('lodash');
var cradle = require('cradle');
var db = new(cradle.Connection)().database('secretintest', 5984, {
  cache: false,
  raw: false,
  forceSave: false
});
var forge = require('node-forge');
var rsa = forge.pki.rsa;
var BigInteger = forge.jsbn.BigInteger;
var redis = require('redis');
var speakeasy = require('speakeasy');
var url = require('url');

client = redis.createClient();

app.use(cors());
app.use(express.static('client'));
app.use(bodyParser.json());


function userExists(name, callback){
  db.view('users/getUser', { key: name }, function (err, doc) {
    if(err === null && typeof doc !== 'undefined' && doc.length === 1){
      callback(true, doc[0].value.res, {id: doc[0].id, rev: doc[0].value.rev});
    }
    else{
      callback(false, {});
    }
  });
}

function secretExists(title, callback){
  db.view('secrets/getSecret', { key: title }, function (err, doc) {
    if(err === null && typeof doc !== 'undefined' && doc.length === 1){
      callback(true, doc[0].value.res, {id: doc[0].id, rev: doc[0].value.rev});
    }
    else{
      callback(false, {});
    }
  });
}

function checkSignature(name, sig, datas, callback) {
  userExists(name, function(exists, user, metaUser){
    if(exists){
      var n = new Buffer(user.publicKey.n, 'base64');
      var e = new Buffer(user.publicKey.e, 'base64');

      var publicKey = rsa.setPublicKey(new BigInteger(n.toString('hex'), 16), new BigInteger(e.toString('hex'), 16));
      var signature = new Buffer(sig, 'hex');


      var pss = forge.pss.create({
        md: forge.md.sha256.create(),
        mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
        saltLength: 32
      });
      var md = forge.md.sha256.create();
      md.update(datas, 'utf8');

      var valid = publicKey.verify(md.digest().getBytes(), signature, pss);

      callback(valid, user, metaUser);
    }
    else{
      callback(false);
    }
  });
}

function checkBruteforce(ip, hash, callback){
  if(hash === 'undefined'){
    callback(false);
  }
  else{
    client.get('bf_'+ip, function(err, res){
      if(res === null){
        client.setex('bf_'+ip, 60, 1, function(err, res){
          callback(false);
        });
      }
      else{
        var count = parseInt(res);
        client.setex('bf_'+ip, count*60, count+1, function(err, res){
          if(count > 5){
            callback(false);
          }
          else{
            callback(false);
          }
        });
      }
    });
  }
}

// test totp
app.get('/totp/:seed/:otp', function (req, res) {
  var verified = speakeasy.totp.verify({
    secret: req.params.seed,
    encoding: 'base32',
    token: req.params.otp
  });
  if(verified){
    res.json('ok');
  }
  else{
    res.writeHead(404, 'Invalid couple', {});
    res.end();
  }
});

function xorSeed(byteArray1, byteArray2) {
  if (byteArray1.length === byteArray2.length && byteArray1.length === 32) {
    const buf = new Uint8Array(32);
    let i;
    for (i = 0; i < 32; i++) {
      buf[i] = byteArray1[i] ^ byteArray2[i];
    }
    return buf;
  }
  throw 'xorSeed wait for 32 bytes arrays';
}

function hexStringToUint8Array(hexString) {
  if (hexString.length % 2 !== 0) {
    throw 'Invalid hexString';
  }
  const arrayBuffer = new Uint8Array(hexString.length / 2);

  for (let i = 0; i < hexString.length; i += 2) {
    const byteValue = parseInt(hexString.substr(i, 2), 16);
    if (isNaN(byteValue)) {
      throw 'Invalid hexString';
    }
    arrayBuffer[i / 2] = byteValue;
  }

  return arrayBuffer;
}


function bytesToHexString(givenBytes) {
  if (!givenBytes) {
    return null;
  }

  const bytes = new Uint8Array(givenBytes);
  const hexBytes = [];

  for (let i = 0; i < bytes.length; ++i) {
    let byteString = bytes[i].toString(16);
    if (byteString.length < 2) {
      byteString = `0${byteString}`;
    }
    hexBytes.push(byteString);
  }
  return hexBytes.join('');
}

// get user keys
app.get('/user/:name/:hash', function (req, res) {
  userExists(req.params.name, function(exists, user){
    if(exists){
        checkBruteforce(req.ip, req.params.hash, function(isBruteforce){
          var md = forge.md.sha256.create();
          md.update(req.params.hash);

          db.view('secrets/getMetadatas', { key: req.params.name }, function (err, doc) {
            if(err === null && typeof doc !== 'undefined'){
              var allMetadatas = {};
              doc.forEach(function(metadatas){
                allMetadatas[metadatas.res.title] = {iv: metadatas.res.iv_meta, secret: metadatas.res.metadatas};
              });
              var totpValid = true;
              if (user.pass.totp && req.params.hash !== 'undefined'){
                totpValid = false;
                var protectedSeed = hexStringToUint8Array(user.seed);
                var hash = hexStringToUint8Array(req.params.hash);
                var seed = bytesToHexString(xorSeed(hash, protectedSeed));
                totpValid = speakeasy.totp.verify({
                  secret: seed,
                  encoding: 'hex',
                  token: req.query.otp
                });
              }

              delete user.seed;
              user.metadatas = allMetadatas;

              // if something goes wrong password send fake private key
              if(!totpValid || isBruteforce || md.digest().toHex() !== user.pass.hash){
                user.privateKey = {
                  privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
                  iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
                };
                user.keys = {};
                user.metadatas = {};
                user.options = {options: '', sig: ''};
              }

              delete user.pass.hash;

              res.json(user);
            }
            else{
              console.log(err);
              res.writeHead(500, 'Unknown error', {});
            }
          });
        });
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

// get protect key
app.get('/protectKey/:name/:deviceId/:hash', function (req, res) {
  userExists(req.params.name, function(exists, user){
    if(exists){
      checkBruteforce(req.ip, req.params.hash, function(isBruteforce){
        if(user.pass.shortpass){
          var md = forge.md.sha256.create();
          md.update(req.params.hash);
          var hashedHash = md.digest().toHex();

          var key = 'protectKey_'+req.params.name+'_'+req.params.deviceId;

          client.hgetall(key, function(err, content) {
            if(content !== null){
              if(isBruteforce || hashedHash !== content.hash){
                content.protectKey = forge.util.bytesToHex((forge.random.getBytesSync(128)));
              }
              delete content.hash;
              content.publicKey = user.publicKey;
              content.totp = user.pass.totp;
              res.json(content);
            }
            else{
              res.writeHead(403, 'Shortpass expired', {});
              res.end();
            }
          });
        }
        else{
          res.writeHead(403, 'Shortpass not activated', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

// get user by token
app.get('/user/:name', function (req, res) {
  checkSignature(req.params.name, req.query.sig, url.parse(req.url).pathname, function(valid, user){
    if(!valid){
      // user.privateKey = {
      //   privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
      //   iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
      // };
      // user.keys = {};
      // user.metadatas = {};
      // user.pass.hash = forge.util.bytesToHex((forge.random.getBytesSync(32)));
      // res.json(user);
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      db.view('secrets/getMetadatas', { key: req.params.name }, function (err, doc) {
        if(err === null && typeof doc !== 'undefined'){
          var allMetadatas = {};
          doc.forEach(function(metadatas){
            allMetadatas[metadatas.res.title] = {iv: metadatas.res.iv_meta, secret: metadatas.res.metadatas};
          });

          user.metadatas = allMetadatas;
          res.json(user);
        }
        else{
          console.log(err);
          res.writeHead(500, 'Unknown error', {});
        }
      });
    }
  });
});

// get database export
app.get('/database/:name', function (req, res) {
  var db = {users : {}, secrets: {}};
  checkSignature(req.params.name, req.query.sig, url.parse(req.url).pathname, function(valid, user){
    if(!valid){
      // user.privateKey = {
      //   privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
      //   iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
      // };
      // delete user.seed;
      // user.keys = {};
      // user.pass.hash = forge.util.bytesToHex((forge.random.getBytesSync(32)));
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      db.users[req.params.name] = user;
      var hashedTitles = Object.keys(user.keys);
      if(hashedTitles.length !== 0){
        hashedTitles.forEach(function(hashedTitle){
          secretExists(hashedTitle, function(exists, secret){
            db.secrets[hashedTitle] = secret;
            db.secrets[hashedTitle].users = [req.params.name];
            if(Object.keys(db.secrets).length === hashedTitles.length){
              res.json(db);
            }
          });
        });
      }
    }
  });
});

//get secret
app.get('/secret/:name/:title', function (req, res) {
  checkSignature(req.params.name, req.query.sig, url.parse(req.url).pathname, function(valid, user){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      secretExists(req.params.title, function(exists, secret){
        if(exists && secret.users.indexOf(req.params.name) !== -1){
          res.json(secret);
        }
        else{
          res.json({
            secret: forge.util.bytesToHex((forge.random.getBytesSync(128))),
            iv: forge.util.bytesToHex((forge.random.getBytesSync(16))),
            users: [forge.util.bytesToHex((forge.random.getBytesSync(32)))]
          });
        }
      });
    }
  });
});

//create user
app.post('/user/:name', function (req, res) {
  userExists(req.params.name, function(exists){
    if(exists){
      res.writeHead(403, 'User already exists', {});
      res.end();
    }
    else{
      var doc = {user: {}};
      var md = forge.md.sha256.create();
      md.update(req.body.pass.hash);
      req.body.pass.hash = md.digest().toHex();
      doc.user[req.params.name] = req.body;
      db.save(doc, function (err, ret) {
        if(err === null && ret.ok === true){
          res.writeHead(200, 'New user saved', {});
          res.end();
        }
        else{
          console.log(err)
          res.writeHead(500, 'Unknown error', {});
          res.end();
        }
      });
    }
  });
});

// activate totp
app.put('/activateTotp/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      var doc = {user: {}};
      doc.user[req.params.name] = user;
      doc.user[req.params.name].pass.totp = true;
      doc.user[req.params.name].seed = jsonBody.seed;

      db.save(metaUser.id, metaUser.rev, doc, function (err, ret) {
        if(err === null && ret.ok === true){
          res.writeHead(200, 'TOTP activated', {});
          res.end();
        }
        else{
          console.log(err);
          res.writeHead(500, 'Unknown error', {});
          res.end();
        }
      });
    }
  });
});

// activate shortpass
app.put('/activateShortpass/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      var doc = {user: {}};

      var md = forge.md.sha256.create();
      md.update(jsonBody.shortpass.hash);
      jsonBody.shortpass.hash = md.digest().toHex();

      doc.user[req.params.name] = user;
      doc.user[req.params.name].pass.shortpass = true;

      db.save(metaUser.id, metaUser.rev, doc, function (err, ret) {
        if(err === null && ret.ok === true){
          var key = 'protectKey_'+req.params.name+'_'+jsonBody.shortpass.deviceId;
          client.hmset(key, [
            'salt', jsonBody.shortpass.salt,
            'iterations', jsonBody.shortpass.iterations,
            'hash', jsonBody.shortpass.hash,
            'protectKey', jsonBody.shortpass.protectKey
            ], function (err, r) {
              client.expire(key, 60*60*24*7, function(err, r2){
                res.writeHead(200, 'Shortpass activated', {});
                res.end();
              });
          });
        }
        else{
          console.log(err);
          res.writeHead(500, 'Unknown error', {});
          res.end();
        }
      });
    }
  });
});

//update password or options
app.put('/user/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      var doc = {user: {}};
      if(req.query.type === 'options'){
        doc.user[req.params.name] = user;
        doc.user[req.params.name].options = jsonBody;
      }
      else{
        var md = forge.md.sha256.create();
        md.update(jsonBody.pass.hash);
        jsonBody.pass.hash = md.digest().toHex();

        doc.user[req.params.name] = user;
        doc.user[req.params.name].privateKey = jsonBody.privateKey;
        doc.user[req.params.name].pass = jsonBody.pass;
      }
      db.save(metaUser.id, metaUser.rev, doc, function (err, ret) {
        if(err === null && ret.ok === true){
          res.writeHead(200, 'User updated', {});
          res.end();
        }
        else{
          console.log(err);
          res.writeHead(500, 'Unknown error', {});
          res.end();
        }
      });
    }
  });
});

//create secret
app.post('/secret/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      secretExists(jsonBody.title, function(sExists){
        if(sExists){
          res.writeHead(403, 'Secret already exists', {});
          res.end();
        }
        else{
          var doc = {secret: {}};

          doc.secret[jsonBody.title] = {
            secret: jsonBody.secret,
            iv: jsonBody.iv,
            metadatas: jsonBody.metadatas,
            iv_meta: jsonBody.iv_meta,
            users: [req.params.name]
          };

          user.keys[jsonBody.title] = {
            key: jsonBody.key,
            rights: 2
          };

          var userDoc = {user: {}};
          userDoc.user[req.params.name] = user;
          db.save(metaUser.id, metaUser.rev, userDoc, function (err, ret) {
            if(err === null && ret.ok === true){
              db.save(doc, function (err, ret) {
                if(err === null && ret.ok === true){
                  res.writeHead(200, 'New secret saved', {});
                  res.end();
                }
                else{
                  console.log(err)
                  res.writeHead(500, 'Unknown error', {});
                  res.end();
                }
              });
            }
            else{
              console.log(err)
              res.writeHead(500, 'Unknown error', {});
              res.end();
            }
          });
        }
      });
    }
  });
});

//delete secret
app.delete('/secret/:name/:title', function (req, res) {
  checkSignature(req.params.name, req.body.sig, 'DELETE '+url.parse(req.url).pathname, function(valid, currentUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      secretExists(req.params.title, function(sExists, secret, metaSecret){
        if(sExists){
          if(typeof currentUser.keys[req.params.title].rights !== 'undefined' && currentUser.keys[req.params.title].rights > 1){
            var Users = {};
            var done = 0;
            secret.users.forEach(function(username){
              userExists(username, function(uExists, user, metaUser){
                done += 1;
                if(uExists){
                  var userDoc = {user: {}};
                  userDoc.user[username] = user;
                  delete userDoc.user[username].keys[req.params.title];
                  Users[metaUser.id] = {rev: metaUser.rev, doc: userDoc};
                }
                if(done === secret.users.length){
                  var nbUsers = 0;
                  var errors = [];
                  Object.keys(Users).forEach(function(id){
                    db.save(id, Users[id].rev, Users[id].doc, function (err, ret) {
                      nbUsers += 1;
                      if(err !== null || ret.ok !== true){
                        console.log(JSON.stringify(Users[id]));
                        console.log(err)
                        errors.push('Unknown error');
                      }
                      if(nbUsers === Object.keys(Users).length){
                        if(errors.length === 0){
                          db.remove(metaSecret.id, metaSecret.rev, function(err, ret){
                            if(err === null && ret.ok === true){
                              res.writeHead(200, 'Secret deleted');
                              res.end();
                            }
                            else{
                              console.log(JSON.stringify(metaSecret));
                              console.log(err)
                              res.writeHead(500, 'Unknown error', {});
                              res.end();
                            }
                          });
                        }
                        else{
                          res.writeHead(500, errors.join('\n'), {});
                          res.end();
                        }
                      }
                    });
                  });
                }
              });
            });
          }
          else{
            res.writeHead(403, 'You can\'t delete this secret', {});
            res.end();
          }
        }
        else{
          res.writeHead(404, 'Secret not found', {});
          res.end();
        }
      });
    }
  });
});

//update secret
app.put('/secret/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      secretExists(jsonBody.title, function(sExists, secret, metaSecret){
        if(sExists){
          if(typeof user.keys[jsonBody.title].rights !== 'undefined' && user.keys[jsonBody.title].rights > 0){
            var secretDoc = {secret: {}};
            secretDoc.secret[jsonBody.title] = secret
            secretDoc.secret[jsonBody.title].iv = jsonBody.iv;
            secretDoc.secret[jsonBody.title].secret = jsonBody.secret;
            secretDoc.secret[jsonBody.title].iv_meta = jsonBody.iv_meta;
            secretDoc.secret[jsonBody.title].metadatas = jsonBody.metadatas;
            db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
              if(err === null && ret.ok === true){
                res.writeHead(200, 'Secret updated', {});
                res.end();
              }
              else{
                console.log(err);
                res.writeHead(500, 'Unknown error', {});
                res.end();
              }
            });
          }
          else{
            res.writeHead(403, 'You can\'t edit this secret', {});
            res.end();
          }
        }
        else{
          res.writeHead(404, 'Secret not found', {});
          res.end();
        }
      });
    }
  });
});

//generate new intermetiade key and reshare
app.post('/newKey/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      secretExists(jsonBody.title, function(sExists, secret, metaSecret){
        if(sExists){
          if(typeof user.keys[jsonBody.title].rights !== 'undefined' && user.keys[jsonBody.title].rights > 1){
            secret.secret    = jsonBody.secret.secret;
            secret.iv        = jsonBody.secret.iv;
            secret.iv_meta   = jsonBody.secret.iv_meta;
            secret.metadatas = jsonBody.secret.metadatas;

            var secretDoc = {secret: {}};
            secretDoc.secret[jsonBody.title] = secret;

            db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
              if(err === null && ret.ok === true){
                var OK = 0;
                var KO = 0;
                jsonBody.wrappedKeys.forEach(function(wrappedKey){
                  userExists(wrappedKey.user, function(uFExists, fUser, metaFUser){
                    if(uFExists){
                      fUser.keys[jsonBody.title].key = wrappedKey.key;

                      var fUserDoc = {user: {}};
                      fUserDoc.user[wrappedKey.user] = fUser;

                      db.save(metaFUser.id, metaFUser.rev, fUserDoc, function (err, ret) {
                        if(err === null && ret.ok === true){
                          OK += 1;
                        }
                        else{
                          console.log(err)
                          KO +=1;
                        }
                        if(OK+KO === jsonBody.wrappedKeys.length){
                          if(KO === 0){
                            res.writeHead(200, 'Generated new key reshared', {});
                            res.end();
                          }
                          else{
                            res.writeHead(500, 'Unknown error', {});
                            res.end();
                          }
                        }
                      });
                    }
                  });
                });
              }
              else{
                console.log(err)
                res.writeHead(500, 'Unknown error', {});
                res.end();
              }
            });
          }
          else{
            res.writeHead(403, 'You can\'t reset this key', {});
            res.end();
          }
        }
        else{
          res.writeHead(404, 'Secret not found', {});
          res.end();
        }
      });
    }
  });
});

//unshare a secret
app.post('/unshare/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      secretExists(jsonBody.title, function(sExists, secret, metaSecret){
        if(sExists){
          var secretDoc = {secret: {}};
          secretDoc.secret[jsonBody.title] = secret;
          if(typeof user.keys[jsonBody.title].rights !== 'undefined' && user.keys[jsonBody.title].rights > 1){
            var errors = [];
            var FUsers = {};
            var nbSecretDone = 0;
            var yourself = 0;
            jsonBody.friendNames.forEach(function(friendName){
              userExists(friendName, function(uFExists, fUser, metaFUser){
                if(req.params.name !== friendName){
                  if(uFExists){
                    if(typeof fUser.keys[jsonBody.title] !== 'undefined'){
                      nbSecretDone += 1;
                      if(metaFUser.id in FUsers){
                        delete FUsers[metaFUser.id].doc.user[friendName].keys[jsonBody.title];
                      }
                      else{
                        delete fUser.keys[jsonBody.title];
                        var fUserDoc = {user: {}};
                        fUserDoc.user[friendName] = fUser;
                        FUsers[metaFUser.id] = {rev: metaFUser.rev, doc: fUserDoc};
                      }

                      _.remove(secretDoc.secret[jsonBody.title].users, function(currentUser) {
                        return (currentUser === friendName);
                      });

                      if((errors.length+nbSecretDone) === (jsonBody.friendNames.length-yourself)){
                        if(errors.length === 0){
                          var errors2 = [];
                          var nbUsers = 0;
                          Object.keys(FUsers).forEach(function(id){
                            db.save(id, FUsers[id].rev, FUsers[id].doc, function (err, ret) {
                              nbUsers += 1;
                              if(err !== null || ret.ok !== true){
                                console.log(err)
                                errors2.push('Unknown error');
                              }
                              if(nbUsers === Object.keys(FUsers).length){
                                db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
                                  if(err !== null || ret.ok !== true){
                                    console.log(err)

                                    errors2.push('Unknown error');
                                  }
                                  if(errors2.length === 0){
                                    res.writeHead(200, 'Secret unshared', {});
                                    res.end();
                                  }
                                  else{
                                    res.writeHead(500, 'Unknown error', {});
                                    res.end();
                                  }
                                });
                              }
                            });
                          })
                        }
                        else{
                          res.writeHead(500, errors.join('\n'), {});
                          res.end();
                        }
                      }
                    }
                    else{
                      res.writeHead(500, 'Desync', {'Content-Type': 'application/json; charset=utf-8'});
                      res.end(JSON.stringify({friendName: friendName, title: jsonBody.title}));
                    }
                  }
                  else{
                    errors.push('Friend ' + friendName + ' not found');
                    if(errors.length === jsonBody.secretObjects.length){
                      res.writeHead(500, errors.join('\n'), {});
                      res.end();
                    }
                  }
                }
                else{
                  yourself = 1;
                  if(jsonBody.friendNames.length === 1){
                    res.writeHead(200, 'You can\'t unshare with yourself', {});
                    res.end();
                  }
                }
              });
            });
          }
          else{
            res.writeHead(403, 'You can\'t unshare secret '+jsonBody.title, {});
            res.end();
          }
        }
        else{
          res.writeHead(404, 'Secret not found', {});
          res.end();
        }
      });
    }
  });
});


// share a secret
app.post('/share/:name', function (req, res) {
  checkSignature(req.params.name, req.body.sig, req.body.json, function(valid, user, metaUser){
    if(!valid){
      res.writeHead(403, 'Invalid signature', {});
      res.end();
    }
    else{
      var jsonBody = JSON.parse(req.body.json);
      var errors = [];
      var FUsers = {};
      var Secrets = {};
      var nbSecretDone = 0;
      if(jsonBody.secretObjects.length === 0){
        res.writeHead(200, 'Secret shared', {});
        res.end();
      }
      else{
        jsonBody.secretObjects.forEach(function(secretObject){
          secretExists(secretObject.hashedTitle, function(sExists, secret, metaSecret){
            if(sExists){
              if(typeof user.keys[secretObject.hashedTitle].rights !== 'undefined' && user.keys[secretObject.hashedTitle].rights > 1){
                if(req.params.name !== secretObject.friendName){
                  userExists(secretObject.friendName, function(uFExists, fUser, metaFUser){
                    if(uFExists){
                      nbSecretDone += 1;
                      if(metaSecret.id in Secrets){
                        Secrets[metaSecret.id].doc.secret[secretObject.hashedTitle].users.push(secretObject.friendName);
                        Secrets[metaSecret.id].doc.secret[secretObject.hashedTitle].users = _.uniq(Secrets[metaSecret.id].doc.secret[secretObject.hashedTitle].users)
                      }
                      else{
                        var secretDoc = {secret: {}};
                        secret.users.push(secretObject.friendName);
                        secret.users = _.uniq(secret.users);
                        secretDoc.secret[secretObject.hashedTitle] = secret

                        Secrets[metaSecret.id] = {rev: metaSecret.rev, doc: secretDoc};
                      }

                      if(metaFUser.id in FUsers){
                        FUsers[metaFUser.id].doc.user[secretObject.friendName].keys[secretObject.hashedTitle] = {
                          key: secretObject.wrappedKey,
                          rights: secretObject.rights
                        };
                      }
                      else{
                        fUser.keys[secretObject.hashedTitle] = {
                          key: secretObject.wrappedKey,
                          rights: secretObject.rights
                        };

                        var fUserDoc = {user: {}};
                        fUserDoc.user[secretObject.friendName] = fUser;
                        FUsers[metaFUser.id] = {rev: metaFUser.rev, doc: fUserDoc};
                      }

                      if((nbSecretDone + errors.length) === jsonBody.secretObjects.length){
                        if(errors.length === 0){
                          var errors2 = []
                          var nbUsers = 0;
                          Object.keys(FUsers).forEach(function(idFuser){
                            db.save(idFuser, FUsers[idFuser].rev, FUsers[idFuser].doc, function (err, ret) {
                              nbUsers += 1;
                              if(err !== null || ret.ok !== true){
                                console.log(FUsers[idFuser]);
                                console.log(err)
                                errors2.push('Unknown error');
                              }
                              if(nbUsers === Object.keys(FUsers).length){
                                var nbSecrets = 0;
                                Object.keys(Secrets).forEach(function(idSecret){
                                  db.save(idSecret, Secrets[idSecret].rev, Secrets[idSecret].doc, function (err, ret) {
                                    nbSecrets += 1;
                                    if(err !== null || ret.ok !== true){
                                      console.log(Secrets[idSecret]);
                                      console.log(err)
                                      errors2.push('Unknown error');
                                    }
                                    if(nbSecrets === Object.keys(Secrets).length){
                                      if(errors2.length === 0){
                                        res.writeHead(200, 'Secret shared', {});
                                        res.end();
                                      }
                                      else{
                                        res.writeHead(500, 'Unknown error', {});
                                        res.end();
                                      }
                                    }
                                  });
                                });
                              }
                            });
                          });
                        }
                        else{
                          res.writeHead(500, errors.join('\n'), {});
                          res.end();
                        }
                      }
                    }
                    else{
                      errors.push('Friend ' + secretObject.friendName + ' not found');
                      if(errors.length === jsonBody.secretObjects.length){
                        res.writeHead(500, errors.join('\n'), {});
                        res.end();
                      }
                    }
                  });
                }
                else{
                  errors.push('You can\'t share with yourself');
                  if(errors.length === jsonBody.secretObjects.length){
                    res.writeHead(500, errors.join('\n'), {});
                    res.end();
                  }
                }
              }
              else{
                errors.push('You can\'t share secret '+secretObject.hashedTitle);
                if(errors.length === jsonBody.secretObjects.length){
                  res.writeHead(500, errors.join('\n'), {});
                  res.end();
                }
              }
            }
            else{
              errors.push('Secret ' + secretObject.hashedTitle + ' not found');
              if(errors.length === jsonBody.secretObjects.length){
                res.writeHead(500, errors.join('\n'), {});
                res.end();
              }
            }
          });
        });
      }
    }
  });
});

var port = 3000;

if(process.argv.length === 3){
    port = parseInt(process.argv[2]);
}

var server = app.listen(port, '127.0.0.1', function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);

});


app.get('/reset', function (req, res) {
  var db = new(cradle.Connection)().database('secretintest', 5984, {
    cache: false,
    raw: false,
    forceSave: false
  });
  db.destroy(function(err){
    db.create(function(err){
      db.save('_design/users', {
            getUser: {
                map: function(doc) {
                  if(doc.user){
                    var key = Object.keys(doc.user)[0];
                    emit(key, {res: doc.user[key], rev: doc._rev});
                  }
                }
            }
      });

      db.save('_design/secrets', {
            getSecret: {
                map: function(doc) {
                  if(doc.secret){
                    var key = Object.keys(doc.secret)[0];
                    emit(key, {res: doc.secret[key], rev: doc._rev});
                  }
                }
            },
            getMetadatas: {
              map: function (doc) {
                if(doc.secret){
                  var key = Object.keys(doc.secret)[0];
                  var res = doc.secret[key].users;
                  doc.secret[key].users.forEach(function(user){
                    emit(user, {res: {title: key, iv_meta: doc.secret[key].iv_meta, metadatas: doc.secret[key].metadatas}, rev: doc._rev});
                  });
                }
              }
            }
      });
      res.writeHead(200, 'DB reset', {});
      res.end();
    });
  });
});