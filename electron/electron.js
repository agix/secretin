const electron = require('electron');
// Module to control application life.
const {app} = electron;
// Module to catch shortcut
const {globalShortcut} = electron;
// Module to create native browser window.
const {BrowserWindow} = electron;

const {ipcMain} = electron;

var robot = require('robotjs');
// const menu = Menu.buildFromTemplate(template);
// Menu.setApplicationMenu(menu);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

var fakeClipboard = '';


function createWindow() {
  // Create the browser window.
  if(process.argv[2] === 'preLogon'){
    win = new BrowserWindow({width: 800, height: 600, frame: false});
    win.setClosable(false);

    var shortcut = 'Ctrl+V'
    globalShortcut.register(shortcut, () => {
      setTimeout(function(){
        robot.typeString(fakeClipboard);
        fakeClipboard = '';
      }, 500);
    });

    ipcMain.on('changeClipboard', (event, arg) => {
      fakeClipboard = arg;
      win.minimize();
      event.returnValue = true;
    });
  }
  else{
    win = new BrowserWindow({width: 800, height: 600});
    ipcMain.on('changeClipboard', (event, arg) => { // prevent freeze in non-preLogon mode
      event.returnValue = true;
    });
  }
  win.setMenu(null)

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  // win.webContents.openDevTools();

  // Emitted when the window is closed.
  win.on('closed', (e) => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);


// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.