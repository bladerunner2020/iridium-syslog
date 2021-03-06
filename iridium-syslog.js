// Module: SysLogServer
/*global IR, EventEmitter */


// Log levels
SyslogServer.LOG_LEVEL_EMERGENCY = 0;
SyslogServer.LOG_LEVEL_ALERT = 1;
SyslogServer.LOG_LEVEL_CRITICAL = 2;
SyslogServer.LOG_LEVEL_ERROR = 3;
SyslogServer.LOG_LEVEL_WARNING = 4;
SyslogServer.LOG_LEVEL_NOTICE = 5;
SyslogServer.LOG_LEVEL_INFO = 6;
SyslogServer.LOG_LEVEL_DEBUG = 7;
SyslogServer.LOG_LEVEL_NEVER = 8;

SyslogServer.setLogLevel = function(logLevel) {
    SyslogServer.logLevel = logLevel;
};
SyslogServer.logLevel = SyslogServer.LOG_LEVEL_WARNING;

// eslint-disable-next-line no-unused-vars
function SyslogServer(port, name) {
    if (typeof EventEmitter != 'undefined') {
        EventEmitter.call(this);
        this.on('error', function() {}); // This is necessary to prevent UNHANDLED_ERROR exception
    } else {
        // It's better to use EventHandler module, but if it's not used
        // we need to define function from EvenHandler
        this.callbacks = {};

        this.on = function (event, callback) {
            if (this.callbacks[event]) {
                this.callbacks[event].push(callback);
            } else {
                this.callbacks[event] = [callback];
            }
    
            return this;
        };
    
        this.emit = function(/* event, arg1, arg2 ...*/) {
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
    }

    var that = this;

    this.forwardDriver = null;
    this.forwardEnabled = true;

    this.port = port || 514;
    this.serverName = name || 'SyslogServer';
    this.server = IR.CreateDevice(IR.DEVICE_CUSTOM_SERVER_UDP, this.serverName, {
        Port: this.port,
        MaxClients: 5,
        LogLevel: SyslogServer.logLevel});  // уровень отладки Warning (https://dev.iridi.com/Drivers_API/en#Log_Levels)

    this.setPort = function (port) {
        this.port = port;
        this.server.SetParameters({Port: port});
        
        return this;
    };

    this.disableServer = function () {
        // this.server.Disconnect();  // Не работает в текущей версии Iridium?

        IR.RemoveListener(IR.EVENT_ONLINE, this.server,onEventOnline);
        IR.RemoveListener(IR.EVENT_OFFLINE, this.server, onEventOffline);
        IR.RemoveListener(IR.EVENT_RECEIVE_TEXT, this.server, onReceiveText);
        this.server.Disconnect();
    };

    this.enableServer = function () {
        this.disableServer();
        
        IR.AddListener(IR.EVENT_ONLINE, this.server,onEventOnline);
        IR.AddListener(IR.EVENT_OFFLINE, this.server, onEventOffline);
        IR.AddListener(IR.EVENT_RECEIVE_TEXT, this.server, onReceiveText);
        this.server.Connect();   // Неправильно вызывать если не вызывать Disconnect
    };


    // Пример Syslog сообщения:
    // <6>[13-11-2018 20:38:09.962]	INFO	SCRIPT	Some Message...
    // Разделитель: \t

    this.parseSyslogMessage = function (text) {
        var index1 = text.indexOf('[');
        var index2 = text.indexOf(']');
        var index3 = text.indexOf('\n');
        if (index3 == -1) {
            index3 = text.length;
        }

        if (index2 === -1) {
            index1 = -1;
            index2 = 0;
        }

        var dateStr = text.substr(index1 + 1, index2 - index1 - 1);
        var dataStr = text.substr(index2 + 1, index3 - index2 - 1);

        var data = dataStr.split('\t');

        var event = data.length > 1 ? data[1].toLowerCase() : '';
        var source = data.length > 2 ? data[2] : '';
        var message = data.length > 3 ? data[3] : data[0];

        if (event == 'warning') {
            // В случае ошибки в JS Iridium выдает сообщение с типом 'warning' такого вида:
            // Script exception: TypeError: C:\Users\PC\Documents\iRidium pro documents\Client\debug-console\scripts\main.js:452: Tried to use null as an object
            // чтобы сделать его читаемым, удаляем путь и оставляем только имя файла

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
            
            if (ip != '' && ip != undefined) {
                this.forwardDriver.Connect();
            } else {
                this.forwardDriver.Disconnect();
            }
        } else if (ip != '' && ip != undefined) {
            this.forwardDriver = IR.CreateDevice(IR.DEVICE_CUSTOM_UDP, 'SysLogSender', {
                Host: ip,
                Port: port || 514,
                LocalPort: port || 514,
                Group: null,             // null - broadcast, "host" - multicast group
                Multicast: false,       // false - broadcast, true - multicast (if multicast group added)
                ScriptMode: IR.DIRECT_AND_SCRIPT,
                LogLevel: SyslogServer.logLevel
            });
            this.forwardDriver.Connect();
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

    function onEventOnline() {
        var d = new Date();
        var timestamp =
            ('00' + d.getDate()).slice(-2) + '-' +
            ('00' + (d.getMonth() + 1)).slice(-2) + '-' +
            d.getFullYear() + ' ' +
            ('00' + d.getHours()).slice(-2) + ':' +
            ('00' + d.getMinutes()).slice(-2) + ':' +
            ('00' + d.getSeconds()).slice(-2) + '.' +
            ('000' + d.getMilliseconds()).slice(-3);

        var msg = {event: 'info', message: 'SyslogServer - online', source: 'SyslogServer', timestamp: timestamp};

        that.emit('all', msg);
        that.emit('online', msg);
    }
    
    function onEventOffline() {
        var d = new Date();
        var timestamp =
            ('00' + d.getDate()).slice(-2) + '-' +
            ('00' + (d.getMonth() + 1)).slice(-2) + '-' +
            d.getFullYear() + ' ' +
            ('00' + d.getHours()).slice(-2) + ':' +
            ('00' + d.getMinutes()).slice(-2) + ':' +
            ('00' + d.getSeconds()).slice(-2) + '.' +
            ('000' + d.getMilliseconds()).slice(-3);

        var msg = {event: 'info', message: 'SyslogServer - offline', source: 'SyslogServer', timestamp: timestamp};

        that.emit('all', msg);
        that.emit('offline', msg);        
    }
    
    function onReceiveText(text) {
        var msg = that.parseSyslogMessage(text);

        that.emit('all', msg);
        that.emit(msg.event, msg);

        if (that.forwardDriver && that.forwardEnabled) {
            that.forwardDriver.Send([text]);
        }        
    }

    IR.AddListener(IR.EVENT_ONLINE, this.server,onEventOnline);
    IR.AddListener(IR.EVENT_OFFLINE, this.server, onEventOffline);
    IR.AddListener(IR.EVENT_RECEIVE_TEXT, this.server, onReceiveText);
}
