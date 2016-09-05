var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var _ = require('lodash');
var cradle = require('cradle');
var db = new(cradle.Connection)().database('secretin', 5984, {
  cache: false,
  raw: false,
  forceSave: false
});
var forge = require('node-forge');
var rsa = forge.pki.rsa;
var BigInteger = forge.jsbn.BigInteger;
var redis = require('redis');


OPTIONAL_SALT = '';

client = redis.createClient();

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

function checkToken(name, token, callback){
  client.get(name, function(err, res){
    callback(res === token);
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
            callback(true);
          }
          else{
            callback(false);
          }
        });
      }
    });
  }
}

// get user keys
app.get('/user/:name/:hash', function (req, res) {
  userExists(req.params.name, function(exists, user){
    if(exists){
        checkBruteforce(req.ip, req.params.hash, function(isBruteforce){
          var md = forge.md.sha256.create();
          md.update(req.params.hash+OPTIONAL_SALT);
          // if it's wrong password send fake private key
          if(isBruteforce || md.digest().toHex() !== user.pass.hash){
            user.privateKey = {
              privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
              iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
            };
            user.keys = {};
            user.pass.hash = forge.util.bytesToHex((forge.random.getBytesSync(32)));
          }
          res.json(user);
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
  userExists(req.params.name, function(exists, user){
    if(exists){
      checkToken(req.params.name, req.query.token, function(valid){
        if(!valid){
          user.privateKey = {
            privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
            iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
          };
          user.keys = {};
          user.pass.hash = forge.util.bytesToHex((forge.random.getBytesSync(32)));
        }
        res.json(user);
      });
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

//get database export
app.get('/database/:name/:hash', function (req, res) {
  var db = {users : {}, secrets: {}};
  userExists(req.params.name, function(exists, user){
    if(exists){
      checkBruteforce(req.ip, req.params.hash, function(isBruteforce){
        var md = forge.md.sha256.create();
        md.update(req.params.hash + OPTIONAL_SALT);
        if(isBruteforce || md.digest().toHex() !== user.pass.hash){
          user.privateKey = {
            privateKey: forge.util.bytesToHex((forge.random.getBytesSync(3232))),
            iv: forge.util.bytesToHex((forge.random.getBytesSync(16)))
          };
          user.keys = {};
          user.pass.hash = forge.util.bytesToHex((forge.random.getBytesSync(32)));
        }

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
        else{
          res.json(db);
        }
      });
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

//get secret
app.get('/secret/:title', function (req, res) {
  checkToken(req.query.name, req.query.token, function(valid){
    if(valid){
      secretExists(req.params.title, function(exists, secret){
        if(exists && secret.users.indexOf(req.query.name) !== -1){
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
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

//get all metadatas
app.get('/allMetadatas/:name', function (req, res) {
  checkToken(req.params.name, req.query.token, function(valid){
    if(valid){
      db.view('secrets/getMetadatas', { key: req.params.name }, function (err, doc) {
        if(err === null && typeof doc !== 'undefined'){
          var allMetadatas = {};
          doc.forEach(function(metadatas){
            allMetadatas[metadatas.res.title] = {iv: metadatas.res.iv_meta, secret: metadatas.res.metadatas};
          });
          res.json(allMetadatas);
        }
        else{
          console.log(err);
          res.writeHead(500, 'Unknown error', {});
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
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
      md.update(req.body.pass.hash+OPTIONAL_SALT);
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

//update password
app.put('/user/:name', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(exists, user, metaUser){
        if(exists){
          var doc = {user: {}};

          var md = forge.md.sha256.create();
          md.update(req.body.pass.hash+OPTIONAL_SALT);
          req.body.pass.hash = md.digest().toHex();

          doc.user[req.params.name] = user;
          doc.user[req.params.name].privateKey = req.body.privateKey;
          doc.user[req.params.name].pass = req.body.pass;

          db.save(metaUser.id, metaUser.rev, doc, function (err, ret) {
            if(err === null && ret.ok === true){
              res.writeHead(200, 'Password changed', {});
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
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

//create secret
app.post('/user/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(uExists, user, metaUser){
        if(uExists){
          secretExists(req.params.title, function(sExists){
            if(sExists){
              res.writeHead(403, 'Secret already exists', {});
              res.end();
            }
            else{
              var doc = {secret: {}};

              doc.secret[req.params.title] = {
                secret: req.body.secret,
                iv: req.body.iv,
                metadatas: req.body.metadatas,
                iv_meta: req.body.iv_meta,
                users: [req.params.name]
              };

              user.keys[req.params.title] = {
                key: req.body.key,
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
        else{
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

//delete secret
app.delete('/user/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(uExists, user, metaUser){
        if(uExists){
          secretExists(req.params.title, function(sExists, secret, metaSecret){
            if(sExists){
              var secretDoc = {secret: {}};
              secretDoc.secret[req.params.title] = secret;
              _.remove(secretDoc.secret[req.params.title].users, function(currentUser) {
                return (currentUser === req.params.name);
              });

              var userDoc = {user: {}};
              userDoc.user[req.params.name] = user;
              delete userDoc.user[req.params.name].keys[req.params.title];
              db.save(metaUser.id, metaUser.rev, userDoc, function (err, ret) {
                if(err === null && ret.ok === true){
                  if(secretDoc.secret[req.params.title].users.length === 0){
                    db.remove(metaSecret.id, metaSecret.rev, function(err, ret){
                      if(err === null && ret.ok === true){
                        res.writeHead(200, 'Secret deleted', {'Content-Type': 'application/json; charset=utf-8'});
                        res.end(JSON.stringify(true));
                      }
                      else{
                        console.log(err)
                        res.writeHead(500, 'Unknown error', {});
                        res.end();
                      }
                    });
                  }
                  else{
                    db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
                      if(err === null && ret.ok === true){
                        res.writeHead(200, 'Secret deleted', {});
                        res.end();
                      }
                      else{
                        console.log(err)
                        res.writeHead(500, 'Unknown error', {});
                        res.end();
                      }
                    });
                  }
                }
                else{
                  console.log(err)
                  res.writeHead(500, 'Unknown error', {});
                  res.end();
                }
              });
            }
            else{
              res.writeHead(404, 'Secret not found', {});
              res.end();
            }
          });
        }
        else{
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

app.get('/challenge/:name', function (req, res) {
  userExists(req.params.name, function(exists, user){
    if(exists){

      var n = new Buffer(user.publicKey.n, 'base64');
      var e = new Buffer(user.publicKey.e, 'base64');

      var publicKey = rsa.setPublicKey(new BigInteger(n.toString('hex'), 16), new BigInteger(e.toString('hex'), 16));
      var bytes = forge.random.getBytesSync(32);
      client.setex(req.params.name, 20, new Buffer(bytes, 'binary').toString('hex'));
      var encrypted = publicKey.encrypt(bytes, 'RSA-OAEP', {
        md: forge.md.sha256.create()
      });

      res.json({time: Date.now().toString(), value: new Buffer(encrypted, 'binary').toString('hex')});
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

//update secret
app.post('/edit/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(uExists, user, metaUser){
        if(uExists){
          secretExists(req.params.title, function(sExists, secret, metaSecret){
            if(sExists){
              if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 0){
                var secretDoc = {secret: {}};
                secretDoc.secret[req.params.title] = secret
                secretDoc.secret[req.params.title].iv = req.body.iv;
                secretDoc.secret[req.params.title].secret = req.body.secret;
                secretDoc.secret[req.params.title].iv_meta = req.body.iv_meta;
                secretDoc.secret[req.params.title].metadatas = req.body.metadatas;
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
        else{
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

//generate new intermetiade key and reshare
app.post('/newKey/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      secretExists(req.params.title, function(sExists, secret, metaSecret){
        if(sExists){
          userExists(req.params.name, function(uExists, user, metaUser){
            if(uExists){
              if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 1){
                secret.secret    = req.body.secret.secret;
                secret.iv        = req.body.secret.iv;
                secret.iv_meta   = req.body.secret.iv_meta;
                secret.metadatas = req.body.secret.metadatas;

                var secretDoc = {secret: {}};
                secretDoc.secret[req.params.title] = secret;

                db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
                  if(err === null && ret.ok === true){
                    var OK = 0;
                    var KO = 0;
                    req.body.wrappedKeys.forEach(function(wrappedKey){
                      userExists(wrappedKey.user, function(uFExists, fUser, metaFUser){
                        if(uFExists){
                          fUser.keys[req.params.title].key = wrappedKey.key;

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
                            if(OK+KO === req.body.wrappedKeys.length){
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
              res.writeHead(404, 'User not found', {});
              res.end();
            }
          });
        }
        else{
          res.writeHead(404, 'Secret not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

//unshare a secret
app.post('/unshare/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(uExists, user, metaUser){
        if(uExists){
          secretExists(req.params.title, function(sExists, secret, metaSecret){
            if(sExists){
              var secretDoc = {secret: {}};
              secretDoc.secret[req.params.title] = secret;
              if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 1){
                var errors = [];
                var FUsers = {};
                var nbSecretDone = 0;
                var yourself = 0;
                req.body.friendNames.forEach(function(friendName){
                  userExists(friendName, function(uFExists, fUser, metaFUser){
                    if(req.params.name !== friendName){
                      if(uFExists){
                        if(typeof fUser.keys[req.params.title] !== 'undefined'){
                          nbSecretDone += 1;
                          if(metaFUser.id in FUsers){
                            delete FUsers[metaFUser.id].doc.user[friendName].keys[req.params.title];
                          }
                          else{
                            delete fUser.keys[req.params.title];
                            var fUserDoc = {user: {}};
                            fUserDoc.user[friendName] = fUser;
                            FUsers[metaFUser.id] = {rev: metaFUser.rev, doc: fUserDoc};
                          }

                          _.remove(secretDoc.secret[req.params.title].users, function(currentUser) {
                            return (currentUser === friendName);
                          });

                          if((errors.length+nbSecretDone) === (req.body.friendNames.length-yourself)){
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
                          res.end(JSON.stringify({friendName: friendName, title: req.params.title}));
                        }
                      }
                      else{
                        errors.push('Friend ' + friendName + ' not found');
                        if(errors.length === req.body.secretObjects.length){
                          res.writeHead(500, errors.join('\n'), {});
                          res.end();
                        }
                      }
                    }
                    else{
                      yourself = 1;
                      if(req.body.friendNames.length === 1){
                        res.writeHead(200, 'You can\'t unshare with yourself', {});
                        res.end();
                      }
                    }
                  });
                });
              }
              else{
                res.writeHead(403, 'You can\'t unshare this secret', {});
                res.end();
              }
            }
            else{
              res.writeHead(404, 'Secret not found', {});
              res.end();
            }
          });
        }
        else{
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});


// share a secret
app.post('/share/:name', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(uExists, user, metaUser){
        if(uExists){
          var errors = [];
          var FUsers = {};
          var Secrets = {};
          var nbSecretDone = 0;
          if(req.body.secretObjects.length === 0){
            res.writeHead(200, 'Secret shared', {});
            res.end();
          }
          else{
            req.body.secretObjects.forEach(function(secretObject){
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

                          if((nbSecretDone + errors.length) === req.body.secretObjects.length){
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
                          if(errors.length === req.body.secretObjects.length){
                            res.writeHead(500, errors.join('\n'), {});
                            res.end();
                          }
                        }
                      });
                    }
                    else{
                      errors.push('You can\'t share with yourself');
                      if(errors.length === req.body.secretObjects.length){
                        res.writeHead(500, errors.join('\n'), {});
                        res.end();
                      }
                    }
                  }
                  else{
                    errors.push('You can\'t share secret '+secretObject.hashedTitle);
                    if(errors.length === req.body.secretObjects.length){
                      res.writeHead(500, errors.join('\n'), {});
                      res.end();
                    }
                  }
                }
                else{
                  errors.push('Secret ' + secretObject.hashedTitle + ' not found');
                  if(errors.length === req.body.secretObjects.length){
                    res.writeHead(500, errors.join('\n'), {});
                    res.end();
                  }
                }
              });
            });
          }
        }
        else{
          res.writeHead(404, 'User not found', {});
          res.end();
        }
      });
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
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
