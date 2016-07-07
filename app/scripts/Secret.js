var Secret = function(rawContent) {
  var _this = this;

  _this.fields    = [];

  if( typeof(rawContent) !== 'undefined') {
    try {
      var object = JSON.parse(rawContent);
      for(var key in object){
        _this[key] = object[key];
      }
    }
    catch(e) {
      _this.fields.push({"label":"secret", "content": rawContent});
    }
  }

};

Secret.prototype.toString = function(){
  return JSON.stringify(this);
};