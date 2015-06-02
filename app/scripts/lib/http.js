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
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', encodeURI(path));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        resolve(xhr.statusText);
      }
      else{
        reject(xhr.statusText);
      }
    };
    xhr.send(JSON.stringify(datas));
  });
}

function DELETE(path, datas){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('DELETE', encodeURI(path));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        resolve(xhr.statusText);
      }
      else{
        reject(xhr.statusText);
      }
    };
    xhr.send(JSON.stringify(datas));
  });
}