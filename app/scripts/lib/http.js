function GET(path){
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', encodeURI(path))
    xhr.onload = function() {
      if (xhr.status === 200) {
        var datas = JSON.parse(xhr.responseText)
        resolve(datas)
      }
    }
    xhr.send()
  })
}