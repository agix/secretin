document.addEventListener("DOMContentLoaded", function() {
    function getSharedUsers(hashedTitle){
  return api.getSecret(hashedTitle, currentUser).then(function(encryptedSecret){
    return encryptedSecret.users;
  }, function(err){
    throw(err);
  });
}


    function migrate(username, password){
        getKeys(username, password).then(function(){
            return currentUser.decryptTitles();
        }).then(function(){
            Object.keys(currentUser.titles).forEach(function(hashedTitle){
                var title = currentUser.titles[hashedTitle];
                var metadatas = {title: currentUser.titles[hashedTitle].substring(14), users: {}};
                metadatas.users[currentUser.username] = currentUser.keys[hashedTitle].rights;
                currentUser.metadatas = metadatas;
                if(currentUser.keys[hashedTitle].rights > 0){
                    getSecret(hashedTitle).then(function(secretDatas){
                        var rawSecretDatas;
                        try {
                          rawSecretDatas = JSON.parse(secretDatas);
                        }
                        catch(e) {
                          rawSecretDatas = {label: 'secret', content: secretDatas};
                        }
                        editSecret(hashedTitle, metadatas, rawSecretDatas).then(function(){
                            getSharedUsers(hashedTitle).then(function(users){
                                users.forEach(function(user){
                                    unshareSecret(hashedTitle, user, user);
                                });
                            });
                        });
                    });
                }
                else{
                    getSecret(hashedTitle).then(function(secretDatas){
                        var rawSecretDatas;
                        try {
                          rawSecretDatas = JSON.parse(secretDatas);
                        }
                        catch(e) {
                          rawSecretDatas = {label: 'secret', content: secretDatas};
                        }
                        addSecret(metadatas, rawSecretDatas).then(function(){
                            deleteSecret(hashedTitle);
                        });
                    });
                }
            });
        }, function(err){
            alert(err);
        });
    }

    document.getElementById('migrate').addEventListener('click', function(e){
        migrate(document.getElementById('username').value, document.getElementById('password').value);
    });