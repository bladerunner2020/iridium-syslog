
var debugConsole = new DebugConsole({
    lineCount: 25,
    maxBufferSize: 1024,
    noConsoleLog: true, // Важно! Должно быть true в случае использования SyslogServer'а.
  //  defaultPage: 'Main',
    debugPage: 'DebugPopup'});


var syslog =
    new SyslogServer(1514);

syslog
    .on('all', function (msg) {
         debugConsole.log(msg);
    })
    .on('warning', function (msg) {
        IR.GetPopup("MsgBox").GetItem("ErrorText").Text = msg.message;
        IR.ShowPopup("MsgBox");
    });
    //.setForward('192.168.96.56', 1514);


// Функция для показа отладочной панели 
function showDebugConsole() {
    debugConsole.showConsole();
}


// Функции для вывода отладочной информации вместо IR.Log
function _Debug(message) {
    IR.Log('DEBUG: ' + message);
}

function _Log(message) {
    IR.Log(message);
}

function _Error(message) {
    IR.Log('ERROR: ' + message);
}


// Генерируем тестовый контент для вывода 
var count = 0;
IR.SetInterval(1000, function () {
    var index = Math.floor(((Math.random() * 10))/10*3) + 1;
    count++;

    switch (index) {
        case 1:
            _Debug('count = ' + count);
            break;
        case 2:
            _Log('count = ' + count);
            break;
        case 3:
            _Error('count = ' + count);
            break;
    }
});

function throwError() {
    var a = null;
    var b = a.oops;
}

function throwError2() {
    throw new Error('Throw user defined error');
}

