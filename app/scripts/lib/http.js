
// ###################### http.js ######################

function GET(path){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI(path));
    xhr.onload = function() {
      if (xhr.status === 200) {
        var datas = JSON.parse(xhr.responseText);
        resolve(datas);
      }
      else{
        reject(xhr.statusText);
      }
    };
    xhr.send();
  });
}

function POST(path, datas){
  return reqData(path, datas, 'POST');
}

function PUT(path, datas){
  return reqData(path, datas, 'PUT');
}

function reqData(path, datas, type){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open(type, encodeURI(path));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        resolve(xhr.statusText);
      }
      else{
        try{
          var datas = JSON.parse(xhr.responseText);
          reject({status: xhr.statusText, datas: datas});
        }
        catch(err){
          reject(xhr.statusText);
        }
      }
    };
    xhr.send(JSON.stringify(datas));
  });
}

function DELETE(path, datas){
  return reqData(path, datas, 'DELETE');
}