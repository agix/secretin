
function uiSharedUsers(userHash){
  var elem = document.createElement('li');
  elem.classList.add('sharedUserElem');

  var userHashSpan = document.createElement('span');
  userHashSpan.textContent = userHash;

  var unshareBtn = document.createElement('input');
  unshareBtn.type = 'button';
  unshareBtn.value = 'Unshare';
  unshareBtn.addEventListener('click', unshare);

  elem.appendChild(userHashSpan);
  elem.appendChild(unshareBtn);
  return elem;
}

function uiSecret(hashedTitle, title){
  var elem = document.createElement('li');
  elem.classList.add('secretElem');

  var btn = document.createElement('input');
  btn.type = 'button';
  btn.value = 'Show';
  btn.addEventListener('click', show);

  var shareBtn = document.createElement('input');
  shareBtn.type = 'button';
  shareBtn.value = 'Share';
  shareBtn.addEventListener('click', share);

  var editBtn = document.createElement('input');
  editBtn.type = 'button';
  editBtn.value = 'Edit';
  editBtn.addEventListener('click', uiEditSecret);

  var deleteBtn = document.createElement('input');
  deleteBtn.type = 'button';
  deleteBtn.value = 'Delete';
  deleteBtn.addEventListener('click', uiDeleteSecret);

  var titleSpan = document.createElement('span');
  titleSpan.textContent = title.substring(14);

  var br = document.createElement('br');

  var hashSpan = document.createElement('span');
  hashSpan.textContent = hashedTitle;
  hashSpan.style.display = 'none';

  elem.appendChild(hashSpan);
  elem.appendChild(titleSpan);
  elem.appendChild(br);
  elem.appendChild(btn);

  if(currentUser.keys[hashedTitle].rights > 0){
    elem.appendChild(editBtn);
  }
  if(currentUser.keys[hashedTitle].rights > 1){
    elem.appendChild(shareBtn);
  }
  elem.appendChild(deleteBtn);

  return elem;
}

function uiSecretFields(secret) {

  if(secret.version == 0) {
    return uiLegacySecret(secret);
  }
  else {
    return uiMultipleSecretFields(secret);
  }
}

function uiLegacySecret(secret) {

  var textarea = document.createElement('textarea');
  textarea.classList.add('secretContent');
  textarea.id = 'showSecretText';
  textarea.disabled = true;
  textarea.value = secret.content;

  return textarea;
}

function uiMultipleSecretFields(secret) {

  var list = document.createElement('ul');
  list.id = 'showSecretFields';

  for(var f in secret.fields) {

    var field = secret.fields[f];

    var row = document.createElement('li');

    var label = document.createElement('label');
    label.textContent = field['label'] + ' :';
    label.classList.add('showSecretFieldLabel');
    row.appendChild(label);

    var input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = field['content'];
    input.classList.add('showSecretFieldContent');
    row.appendChild(input);

    row.appendChild(copyButton());

    row.appendChild(clearfix());

    list.appendChild(row);
  }

  return list;
}

function uiResetAddSecretFields() {

  var fieldsList = document.getElementById('addSecretFields');
  var fields = fieldsList.getElementsByTagName("li");

  var elementsToRemove = [];

  for (var i = 0; i < fields.length; i++) {

    var li = fields[i];

    if( i >= 1 ) {
      elementsToRemove.push(li);
    }
    else {
      li.querySelector('.editableFieldLabel').value = '';
      li.querySelector('.editableFieldContent').value = '';
    }
  }

  for(var i in elementsToRemove) {
    fieldsList.removeChild(elementsToRemove[i]);
  }

}

function copyButton() {

  var link = document.createElement('a');
  link.classList.add('icon');
  link.classList.add('copyButton');
  link.title = "Copy";
  link.textContent = '❐';

  link.addEventListener('click', function(e) {
    var field = e.target.parentNode.querySelector('.showSecretFieldContent');
    field.select();
    document.execCommand('copy');
    document.getElementById('search').select();
  });

  return link;
}

function clearfix() {
  var clearfix = document.createElement('div');
  clearfix.classList.add('clearfix');
  return clearfix;
}

function uiDeleteField(field) {

  var fieldsList = field.parentNode;
  var fields = fieldsList.getElementsByTagName("li");

  if( fields.length > 1 ) {
    fieldsList.removeChild(field);
  }
}
