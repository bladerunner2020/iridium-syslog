_DEBUGGER.addConsole(new SimpleDebugConsole());


var debugConsole = new DebugConsole({
    lineCount: 30,
    maxBufferSize: 1024,
    noConsoleLog: true,
    defaultPage: 'Main',
    debugPage: 'Debug'});


new SyslogServer()
    .on('all', function (msg) {
         debugConsole.log(msg);
    })
    .on('warning', function (msg) {
        IR.GetPopup("MsgBox").GetItem("ErrorText").Text = msg.message;
        IR.ShowPopup("MsgBox");
    });

var count = 0;
IR.SetInterval(5000, function () {
    var index = Math.floor(((Math.random() * 10))/10*3) + 1;
    count++;

    switch (index) {
        case 1:
            _Debug('count = ' + count, 'app');
            break;
        case 2:
            _Log('count = ' + count, 'app');
            break;
        case 3:
            _Error('count = ' + count, 'app');
            break;
    }
});


function throwError() {
    var a = null;

    var b = a.oops;


   // throw new Error('user defined error');

}

function throwError2() {
    throw new Error('Throw user defined error');
}


