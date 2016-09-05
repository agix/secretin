var Secret = function(type, rawContent) {
  this.parent = false;
  this.editable = true;
  this.fields = [];

  if(typeof(rawContent) !== 'undefined'){
    this.editable = false;

    try {
      var object = JSON.parse(rawContent);
      for(var key in object){
        this[key] = object[key];
      }
    }
    catch(e) {
      this.fields.push({label:'secret', content: rawContent});
    }
  }
  else{
    this.fields.push({label:'', content: ''});
  }
};

Secret.prototype.destroy = function(){
  delete this.fields;
  this.wipe();
};

Secret.prototype.wipe = function(){
  var fieldsList = this.parent.getElementsByTagName('ul')[0];
  if(typeof(fieldsList) !== 'undefined'){
    cleanElement(fieldsList);
  }
};

Secret.prototype.newField = function(data, index){
  var _this = this;
  var field = document.createElement('li');
  var label;
  if(this.editable === true){
    label = document.createElement('input');
    label.type = 'text';
    label.classList.add('secretFieldLabel');
    label.placeholder = 'Label';
    label.value = data.label;
  }
  else{
    label = document.createElement('label');
    label.textContent = data.label+' : ';
  }

  var content = document.createElement('input');
  content.type = 'text';
  content.classList.add('secretFieldContent');
  content.placeholder = 'Secret';
  content.value = data.content;
  if(this.editable !== true){
    content.readOnly = true;
  }

  var iconDelete = document.createElement('a');
  iconDelete.classList.add('icon');
  iconDelete.classList.add('iconDelete');
  iconDelete.title = 'Delete Field';
  iconDelete.textContent = '-';
  iconDelete.addEventListener('click', function(e){
    _this.deleteField(index);
  });
  if(this.editable !== true || this.fields.length < 2){
    iconDelete.style.display = 'none';
  }

  var iconCopy = document.createElement('a');
  iconCopy.classList.add('icon');
  iconCopy.title = 'Copy';
  iconCopy.textContent = '❐';

  iconCopy.addEventListener('click', function(e){
    var field = e.target.parentNode.querySelector('.secretFieldContent');
    field.select();
    document.execCommand('copy');
    document.getElementById('search').select();
  });

  var iconGenerate = document.createElement('a');
  iconGenerate.classList.add('icon');
  iconGenerate.title = 'Generate';
  iconGenerate.textContent = '⎁';

  iconGenerate.addEventListener('click', function(e){
    var field = e.target.parentNode.querySelector('.secretFieldContent');
    field.value = generateRandomString(30);
  });

  field.appendChild(label);
  field.appendChild(content);
  field.appendChild(iconDelete);
  field.appendChild(iconCopy);
  if(this.editable === true){
    field.appendChild(iconGenerate);
  }

  return field;
};

Secret.prototype.redraw = function(){
  this.wipe();
  var fieldsList = this.parent.getElementsByTagName('ul')[0];
  for (var i = 0; i < this.fields.length; i++) {
    fieldsList.appendChild(this.newField(this.fields[i], i));
  }
  var iconAdd = this.parent.querySelector('.bottomIcon');
  if(this.editable !== true){
    iconAdd.style.display = 'none';
  }
  else{
    iconAdd.style.display = '';
  }
};

Secret.prototype.draw = function(parent){
  var _this = this;
  this.parent = parent;
  this.wipe();

  var fieldsList = document.createElement('ul');
  for (var i = 0; i < this.fields.length; i++) {
    fieldsList.appendChild(this.newField(this.fields[i], i));
  }

  var iconAdd = document.createElement('a');
  iconAdd.classList.add('icon');
  iconAdd.classList.add('bottomIcon');
  iconAdd.title = 'Add field';
  iconAdd.textContent = '+';
  if(this.editable !== true){
    iconAdd.style.display = 'none';
  }
  iconAdd.addEventListener('click', function(e){
    _this.addField();
  });

  this.parent.appendChild(fieldsList);
  this.parent.appendChild(iconAdd);
};

Secret.prototype.addField = function(){
  this.getDatas();
  var fieldsList = this.parent.getElementsByTagName('ul')[0];
  var newFieldData = {label: '', content: ''};
  this.fields.push(newFieldData);
  fieldsList.appendChild(this.newField(newFieldData, this.fields.length-1));

  fieldsList.childNodes[0].querySelector('.iconDelete').style.display = '';
};

Secret.prototype.getDatas = function(){
  var fieldsList = this.parent.getElementsByTagName('ul')[0];
  for(var i = 0; i < fieldsList.childNodes.length; i++){
    var field = fieldsList.childNodes[i];
    this.fields[i].content = field.querySelector('.secretFieldContent').value;
    if(this.editable === true){
      this.fields[i].label = field.querySelector('.secretFieldLabel').value;
    }
    else{
      this.fields[i].label = field.querySelector('.secretFieldLabel').textContent;
    }
  }
};

Secret.prototype.deleteField = function(index){
  this.getDatas();
  this.fields.splice(index, 1);
  this.redraw();
};

Secret.prototype.toJSON = function(){
  if(this.parent){
    this.getDatas();
    return {'fields': this.fields};
  }
  else{
    return {};
  }

};

