var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var _ = require('lodash');
var cradle = require('cradle');
var db = new(cradle.Connection)().database('secretin');
var forge = require('node-forge');
var rsa = forge.pki.rsa;
var BigInteger = forge.jsbn.BigInteger;
var redis = require('redis');
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
    callback(res === token)
  });
}

app.get('/user/:name', function (req, res) {
  userExists(req.params.name, function(exists, user){
    if(exists){
      res.json(user);
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

app.get('/database/:name', function (req, res) {
  var db = {users : {}, secrets: {}};
  userExists(req.params.name, function(exists, user){
    if(exists){
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
    }
    else{
      res.writeHead(404, 'User not found', {});
      res.end();
    }
  });
});

app.get('/secret/:title', function (req, res) {
  secretExists(req.params.title, function(exists, secret){
    if(exists){
      res.json(secret);
    }
    else{
      res.writeHead(404, 'Secret not found', {});
      res.end();
    }
  });
});

app.post('/user/:name', function (req, res) {
  userExists(req.params.name, function(exists){
    if(exists){
      res.writeHead(403, 'User already exists', {});
      res.end();
    }
    else{
      var doc = {user: {}};
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

app.put('/user/:name', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      userExists(req.params.name, function(exists, user, metaUser){
        if(exists){
          var doc = {user: {}};
          doc.user[req.params.name] = user;
          doc.user[req.params.name].privateKey = req.body.privateKey;
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

app.post('/user/:name/:title', function (req, res) {
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
            users: [req.params.name]
          };

          user.keys[req.params.title] = {
            title: req.body.title,
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
});

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
      client.setex(req.params.name, 10, new Buffer(bytes, 'binary').toString('hex'));
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

app.post('/newKey/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      secretExists(req.params.title, function(sExists, secret, metaSecret){
        if(sExists){
          userExists(req.params.name, function(uExists, user, metaUser){
            if(uExists){
              if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 1){
                secret.secret = req.body.secret.secret;
                secret.iv = req.body.secret.iv;

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

app.post('/unshare/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      if(req.params.name !== req.body.friendName){
        userExists(req.params.name, function(uExists, user, metaUser){
          if(uExists){
            userExists(req.body.friendName, function(uFExists, fUser, metaFUser){
              if(uFExists){
                secretExists(req.params.title, function(sExists, secret, metaSecret){
                  if(sExists){
                    if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 1){
                      if(typeof fUser.keys[req.params.title] === 'undefined'){
                        res.writeHead(404, 'You didn\'t share this secret with this friend', {});
                        res.end();
                      }
                      else{
                        delete fUser.keys[req.params.title];
                        var fUserDoc = {user: {}};
                        fUserDoc.user[req.body.friendName] = fUser;

                        var secretDoc = {secret: {}};
                        secretDoc.secret[req.params.title] = secret;
                        _.remove(secretDoc.secret[req.params.title].users, function(currentUser) {
                          return (currentUser === req.body.friendName);
                        });

                        db.save(metaFUser.id, metaFUser.rev, fUserDoc, function (err, ret) {
                          if(err === null && ret.ok === true){
                            db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
                              if(err === null && ret.ok === true){
                                res.writeHead(200, 'Secret unshared', {});
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
                res.writeHead(404, 'Friend not found', {});
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
        res.writeHead(403, 'You can\'t unshare with youself', {});
        res.end();
      }
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

app.post('/share/:name/:title', function (req, res) {
  checkToken(req.params.name, req.body.token, function(valid){
    if(valid){
      if(req.params.name !== req.body.friendName){
        userExists(req.params.name, function(uExists, user, metaUser){
          if(uExists){
            userExists(req.body.friendName, function(uFExists, fUser, metaFUser){
              if(uFExists){
                secretExists(req.params.title, function(sExists, secret, metaSecret){
                  if(sExists){
                    if(typeof user.keys[req.params.title].rights !== 'undefined' && user.keys[req.params.title].rights > 1){
                      var secretDoc = {secret: {}};
                      secret.users.push(req.body.friendName);
                      secret.users = _.uniq(secret.users);
                      secretDoc.secret[req.params.title] = secret

                      fUser.keys[req.params.title] = {
                        title: req.body.title,
                        key: req.body.key,
                        rights: req.body.rights
                      };

                      var fUserDoc = {user: {}};
                      fUserDoc.user[req.body.friendName] = fUser;

                      db.save(metaFUser.id, metaFUser.rev, fUserDoc, function (err, ret) {
                        if(err === null && ret.ok === true){
                          db.save(metaSecret.id, metaSecret.rev, secretDoc, function (err, ret) {
                            if(err === null && ret.ok === true){
                              res.writeHead(200, 'Secret shared', {});
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
                    else{
                      res.writeHead(403, 'You can\'t share this secret', {});
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
                res.writeHead(404, 'Friend not found', {});
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
        res.writeHead(403, 'You can\'t share with youself', {});
        res.end();
      }
    }
    else{
      res.writeHead(403, 'Token invalid', {});
      res.end();
    }
  });
});

var server = app.listen(3000, '127.0.0.1', function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);

});