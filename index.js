// Module: SysLogServer

function SyslogServer(port, name) {
    var that = this;

    this.callbacks = {};

    this.port = port || 514;
    this.serverName = name || 'SyslogServer';
    this.server = IR.CreateDevice(IR.DEVICE_CUSTOM_SERVER_UDP, this.serverName,
        {Port: this.port, MaxClients: 1});

    this.setPort = function (port) {
        this.port = port;
        this.server.SetParameters({Port: port});
        
        return this;
    };

    this.parseSyslogMessage = function (text) {
        var levelStr = text.substr(0, 3);
        var index1 = text.indexOf('[');
        var index2 = text.indexOf(']');
        var index3 = text.indexOf('\n');
        if (index3 == -1) {
            index3 = text.length;
        }

        var dateStr = text.substr(index1 + 1, index2 - index1 - 1);
        var dataStr = text.substr(index2 + 1, index3 - index2 - 1);

        var data = dataStr.split('\t');

        var event = data[1].toLowerCase();
        var source = data[2];
        var message = data[3];

        if (event == 'warning') {
            // В случае ошибки в JS Iridium выдает сообщение с типом 'warning' такого вида:
            // Script exception: TypeError: C:\Users\PC\Documents\iRidium pro documents\Client\debug-console\scripts\main.js:452: Tried to use null as an object
            // чтобы сделать его читаемым, удаляем путь и отсавляем только имя файла

            data = message.split('\\');
            if (data.length > 2) {
                message = data[0].slice(0, -2) + data[data.length - 1];
            }
        }

        if (message.indexOf('DEBUG: ') == 0) {
            event = 'debug';
            message = message.substr(7);
        } else if (message.indexOf('ERROR: ') == 0) {
            event = 'error';
            message = message.substr(7);
        }


        return {event: event, message: message, source: source, timestamp : dateStr};
    };

    this.on = function (event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            this.callbacks[event] = [callback];
        }

        return this;
    };

    this.callEvent = function(/* event, arg1, arg2 ...*/) {
        var args = Array.prototype.slice.call(arguments, 0);
        var event = args.shift();
        var callbacks = this.callbacks[event];
        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++) {
                var cb = callbacks[i];
                
                if (cb) {
                    cb.apply(this, args);
                }

            }

        }
    };

    
    IR.AddListener(IR.EVENT_RECEIVE_TEXT, this.server, function(text) {
        var msg = that.parseSyslogMessage(text);
        
        that.callEvent('all', msg);
        that.callEvent(msg.event, msg);
    });
}
