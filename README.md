# secretin
Open source secret manager with groups managment based on webapi crypto http://www.w3.org/TR/WebCryptoAPI/

**No dependencies**, only "vanilla" JS

Exists in two versions :
* Standalone (you have to copy paste you json DB)
* Server saved (CouchDB save your encrypted DB)

# Install
## Standalone
You can download server/client/secretinAlone.tar.gz (https://www.secret-in.me/secretinAlone.tar.gz)
```
wget https://www.secret-in.me/secretinAlone.tar.gz
tar xvzf secretinAlone.tar.gz
cd alone
google-chrome index.html
```

## Server saved
You need to install couchDB and redis on your server.

You can download last dist version secretin.tar.gz
```
tar xvzf secretin.tar.gz
npm install
node install.js
node index.js
```

install.js is just for _design creation in couchDB.

Application listen on localhost port 3000 and should be used with reverse proxy !

**nginx configuration example**
```
server {
    listen      443;
    server_name *.secret-in.me;
    ssl on;
    ssl_certificate /etc/nginx/tls/secret-in.me.crt;
    ssl_certificate_key /etc/nginx/tls/secret-in.me.key;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers 'AES256+EECDH:AES256+EDH';
    ssl_dhparam /etc/nginx/tls/dhparam.pem;
    ssl_prefer_server_ciphers on;

    charset     utf-8;

    client_max_body_size 512M;

    location / {
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_pass http://127.0.0.1:3000;
    }

}
```

**init.d script example**
```
#! /bin/sh -e

DAEMON_DIR="/home/secretin/server/"
DAEMON_LOGDIR="/home/secretin/"
DAEMON_UID="secretin"
DAEMON_NAME="secretin"

case "$1" in
  start)
  echo "Starting $DAEMON_NAME..."
  sudo -H -u secretin forever start --sourceDir=$DAEMON_DIR --workingDir=$DAEMON_DIR -a -o $DAEMON_LOGDIR"access.log" -e $DAEMON_LOGDIR"error.log" --uid $DAEMON_UID index.js
  ;;

  stop)
  echo "Stoping $DAEMON_NAME..."
  sudo -H -u secretin forever stop $DAEMON_UID
  ;;

  *)
  echo "Usage: /etc/init.d/$DAEMON_NAME {start|stop}"
  exit 1
  ;;
esac

exit 0
```


# How it works
## Introduction
Secret-in first aim is to remove any centralised obscur point.
* You can read the whole source code
* No monster libraries included (Jquery I'm looking at you)
* No server confidentiality needs
* Crypto is not part of this code

The only thing you are forced to trust is your browser (and I hope you do because it's difficult to do without). We hope http://www.w3.org/TR/WebCryptoAPI/ is well designed in your modern browser and are not responsible for bad cryptography implementation (as we are not crypto expert at all)

Another point secret-in is trying to handle is secrets sharing.

The whole things try to respect maximum anonymity. We want database leakage to be a feature so no datas should be usable without your keys.
## Details
This part try to explain the whole operation behind secret-in.

First, you need username and master password.

When you create a new account, username is SHA256'ed and a RSA-OAEP key pair is generated (according to http://www.w3.org/TR/WebCryptoAPI/#algorithm-overview array, RSA-OAEP seems to be the only assymetric algorithm that support encrypt and decrypt method)

Then your private key is wrapped with SHA256 of your master password in AES-CBC-256.

When you create a secret, you give a title and a secret content.

The title is salted with the timestamp and encrypted with you public key so you can retrieve its content. It's also SHA256'ed to serve as an ID.

The secret is encrypted using AES-CBC-256 with randomly generated intermediate key.

Finally, this intermediate key is wrapped with your public key and linked with the hashed title.

Any time you want to access a secret, you need to type your master password that would decrypt your private key that would decrypt the intermediate key that would decrypt the secret.

Using this, it's easy to share secret. You need to know the exact username of your friend so you can find his public key to encrypt the intermediate key of the secret. You also need to encrypt the title so he can list it.

In server saved mode every modification requests use challenge to prove user has right to do the modification. It's a simple random token encrypted with claimed user public key.

## "API"
### User
User object has username, publicKey, privateKey, keys, titles and token attributes.
It takes username string as creation argument.
* *generateMasterKey* generate new key pair and populate publicKey and privateKey.
  * it returns nothing
* *exportPublicKey*
  * it returns publicKey a jwk publicKey object
* *importPublicKey* takes jwk publicKey object in argument and populate user publicKey
  * it returns nothing
* *exportPrivateKey* takes password string in argument and encrypt privateKey
  * it returns `{privateKey: hexString, iv: hexString}` object
* *importPrivateKey* takes password string and `{privateKey: hexString, iv: hexString}` object in argument and populate user privateKey
  * it returns nothing
* *createSecret* takes title and secret string arguments, encrypt secret with random key wrapped with publicKey and encrypt title with publicKey
  * it returns `{secret: hexString, iv: hexString, wrappedKey: hexString, encryptedTitle: hexString, hashedUsername: hexString, hashedTitle: hexString}`
* *shareSecret* takes friend user object, wrappedKey hexString and hashedTitle hexString of secret you want to share. It wraps the key and encrypts title with friend publicKey then hashes friend name.
  * it returns `{wrappedKey: hexString, encryptedTitle: hexString, friendName: hexString}`
* *editSecret* takes secret string and wrappedKey hexString arguments. It unwraps the key and encrypt the new secret.
  * it returns `{secret: hexString, iv: hexString}`
* *encryptSecret* takes secret string argument and encrypt it with randomly generated key.
  * it returns `{secret: bytes, iv: bytes, key: CryptoKey object}`
* *decryptSecret* takes secret hexString and wrappedKey hexString arguments.
  * it returns decrypted secret
* *wrapKey* takes CryptoKey object and CryptoKeyPair publicKey object arguments.
  * it returns hexString wrappedKey
* *decryptTitles* decrypt encrypted titles in user keys array and populate titles array.
  * it returns nothing
* *disconnect* delete every user parameters.
  * it returns nothing
### SAVE API
API object takes server url for server saved version and `{users: {}, secrets: {}}` for standalone version.
* *userExists* takes username string as argument.
  * it returns true or false if user exists or not.
* *addUser* takes username string, `{privateKey: hexString, iv: hexString}` object and jwk publicKey object arguments. It adds the user to the DB.
  * it returns nothing.
* *addSecret* takes `{secret: hexString, iv: hexString, wrappedKey: hexString, encryptedTitle: hexString, hashedUsername: hexString, hashedTitle: hexString}` object argument. It adds the secret to the DB.
  * it returns nothing.
* *deleteSecret* takes user object and hashedTitle hexString arguments. It deletes the secret corresponding to the hashedTitle.
  * it returns nothing
* *editSecret* takes user object, `{secret: hexString, iv: hexString}` object and hashedTitle hexString arguments. It edits the secret.
  * it returns nothing
* *unshareSecret* takes user object, friendName string and hashedTitle hexString. It unshares secret for friendName. Be careful, it doesn't renew the intermediate keys for the other.
  * it returns nothing
* *newKey* takes user object, hashedTitle hexString, `{secret: hexString, iv: hexString}` object and array of `{user: hexString, key: hexString}` objects arguments. It's used when intermediate key is changed (when secret unsharing for example).
  * it returns nothing
* *shareSecret* takes user object, `{wrappedKey: hexString, encryptedTitle: hexString, friendName: hexString}` object, hashedTitle hexString and rights (0=read, 1=+write, 2=+share) arguments. It shares secret with friendName.
  * it returns nothing
* *getPublicKey* takes username string or username hexString and boolean to say if it's hashed in arguments.
  * it returns jwk publicKey object.
* *getWrappedPrivateKey* takes username string or username hexString and boolean to say if it's hashed in arguments.
  * it returns `{privateKey: hexString, iv: hexString}` object
* *getKeys* takes username string or username hexString and boolean to say if it's hashed in arguments.
  * it returns list of `{hashedTitle: {title: hexString, key: hexString, right: int}}`
* *getUser* takes username string or username hexString and boolean to say if it's hashed in arguments. It's like getPublicKey, getWrappedPrivateKey and getKeys combined.
  * it returns `{privateKey: {privateKey: hexString, iv: hexString}, publicKey: jwkObject, keys: {hashedTitle01: {title: hexString, key: hexString, right: int}}}`
* *getSecret* it takes hashedTitle hexString argument.
  * it returns secret hexString
* *changePassword* takes user object and `{privateKey: {privateKey: hexString, iv: hexString}` arguments. It changes the master password that wraps the privateKey
  * it returns nothing
* *getDB* takes username string.
  * it returns the whole database used by username.
