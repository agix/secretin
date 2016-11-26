document.getElementById('db').disabled = true;
var secretin = new Secretin(Secretin.API.Server);
if(secretin.canITryShortpass()){
  document.getElementById('shortpassPopup').style.display = '';
}

var qrcode = new QRCode(document.getElementById("qrcode"));

function registerTotp(){
  document.getElementById('qrcodePopup').style.display = '';
  var testTotp = document.getElementById('testTotp');
  var registerTotp = document.getElementById('registerTotp');

  testTotp.style.display = '';
  var seed = Secretin.generateSeed();
  qrcode.clear();
  qrcode.makeCode('otpauth://totp/Secret-in.me?secret='+seed.b32);

  registerTotp.addEventListener('click', function(){
    if(registerTotp.textContent === 'Register'){
      secretin.activateTotp(seed);
    }
    else{
      var token = testTotp.value;
      testTotp.value = 'Please wait...'
      secretin.api.testTotp(seed.b32, token).then(function(){
        testTotp.style.display = 'none';
        registerTotp.style['margin-left'] = '0px';
        registerTotp.textContent = 'Register';
      }, function(err){
        testTotp.value = 'Invalid';
        setTimeout(function(){
          testTotp.value = '';
        }, 3000)
      });
    }
  });
}

document.getElementById('submitShortPass').addEventListener('click', function(){
  if(typeof secretin.currentUser.username === 'undefined'){
    var shortpass = document.getElementById('shortpass');
    secretin.shortLogin(document.getElementById('shortpass').value).then(function(){
      shortpass.value = '';
      document.getElementById('shortpassPopup').style.display = 'none';
      afterLogin();
      return;
    }, function(err){
      shortpass.value = err;
        setTimeout(function(){
          shortpass.value = '';
          document.getElementById('shortpassPopup').style.display = 'none';
        }, 3000)
    });
  }
  else{
    secretin.activateShortpass(document.getElementById('shortpass').value, document.getElementById('deviceName').value).then(function(){
      document.getElementById('shortpass').value = '';
      document.getElementById('shortpassPopup').style.display = 'none';
      return;
    });
  }
})

document.getElementById('totp').addEventListener('click', registerTotp);

document.getElementById('regShortpass').addEventListener('click', function(){
  document.getElementById('deviceName').style.display = '';
  document.getElementById('shortpassPopup').style.display = '';
});

document.addEventListener('click', function(e){
  if(e.target.id !== 'qrcode'
     && e.target.id !== 'totp'
     && e.target.id !== 'qrcodePopup'
     && e.target.tagName !== 'IMG'
     && e.target.id !== 'testTotp'
     && e.target.id !== 'registerTotp'
     && e.target.id !== 'shortpassPopup'
     && e.target.id !== 'shortpass'
     && e.target.id !== 'submitShortPass'
     && e.target.id !== 'regShortpass'
     && e.target.id !== 'deviceName'
    ){
    var qrcodeDiv = document.getElementById("qrcodePopup");
    var shortpassDiv = document.getElementById("shortpassPopup");
    if(qrcodeDiv.style.display !== 'none'){
      qrcodeDiv.style.display = 'none'
    }
    if(shortpassDiv.style.display !== 'none'){
      shortpassDiv.style.display = 'none'
    }
  }
});


});