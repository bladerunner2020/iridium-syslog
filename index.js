// Module: SysLogServer

function SyslogServer(port, name) {
    var that = this;

    this.callbacks = {};
    this.forwardDriver = null;
    this.forwardEnabled = true;

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
            } else {
                data = message.split('/');
                if (data.length > 2) {
                    message = data[0] + data[data.length - 1];
                }
            }
        }


        if (message.indexOf('INFO: ') == 0) {
            event = 'info';
            message = message.substr(6);
        } else if (message.indexOf('DEBUG: ') == 0) {
            event = 'debug';
            message = message.substr(7);
        } else if (message.indexOf('ERROR: ') == 0) {
            event = 'error';
            message = message.substr(7);
        } else if (message.indexOf('WARNING: ') == 0) {
            event = 'warning';
            message = message.substr(9);
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

    this.setForward = function (ip, port) {
        if (this.forwardDriver) {
            var options = {};
            if (ip) {
                options.Host = ip;
            }
            if (port) {
                options.Port = port;
            }
            this.forwardDriver.SetParameters(options);
            this.Connect();
        } else {
            this.forwardDriver = IR.CreateDevice(IR.DEVICE_CUSTOM_UDP, 'SysLogSender', {
                Host: ip,
                Port: port || 514,
                LocalPort: port || 514,
                Group: null,             // null - broadcast, "host" - multicast group
                Multicast: false,       // false - broadcast, true - multicast (if multicast group added)
                ScriptMode: IR.DIRECT_AND_SCRIPT
            });
        }

        return this;
    };

    this.enableForward = function () {
        this.forwardEnabled = true;

        return this;
    };

    this.disableForward = function () {
        this.forwardEnabled = false;

        return this;
    };

    IR.AddListener(IR.EVENT_ONLINE, this.server, function() {
        var msg = {event: 'online', message: 'EVENT_ONLINE', source: 'SyslogServer', timestamp: new Date()};

        that.callEvent('all', msg);
        that.callEvent('online', msg);
    });

    IR.AddListener(IR.EVENT_OFFLINE, this.server, function() {
        var msg = {event: 'offline', message: 'EVENT_OFFLINE', source: 'SyslogServer', timestamp: new Date()};

        that.callEvent('all', msg);
        that.callEvent('offline', msg);
    });


    IR.AddListener(IR.EVENT_RECEIVE_TEXT, this.server, function(text) {
        var msg = that.parseSyslogMessage(text);
        
        that.callEvent('all', msg);
        that.callEvent(msg.event, msg);

        if (that.forwardDriver && that.forwardEnabled) {
            that.forwardDriver.Send([text]);
        }
    });
}
