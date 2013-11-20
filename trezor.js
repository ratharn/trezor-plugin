var trezor = (function () {

//
// Takes care of injecting the trezor plugin into the webpage.
//
var BrowserPlugin = (function () {

    var PLUGIN_ID = '__trezor-plugin',
        PLUGIN_CALLBACK = '__trezorPluginLoaded',
        PLUGIN_MIMETYPE = 'application/x-bitcointrezorplugin';

    var loaded = null,
        waiting, timer;

    // Load trezor browser plugin, optionally with a timeout.
    // In case plugin is not found, calls errback with an err and
    // the install fn.
    function load(callback, errback, timeout){

        if (loaded)
            return callback(loaded);

        if (waiting)
            return errback(new Error('Already being loaded'));

        if (!installed(PLUGIN_MIMETYPE))
            return errback(new Error('Not installed'), install);

        waiting = { // register callbacks
            callback: callback,
            errback: errback
        };
        inject(PLUGIN_ID, PLUGIN_MIMETYPE, PLUGIN_CALLBACK, timeout);
    }

    // Injects browser plugin into the webpage, using provided params.
    // callback is a _global_ function name!
    function inject(id, mimetype, callback, timeout) {

        var loadFn = function () {
                resolve(null, document.getElementById(id));
            },
            timeoutFn = function () {
                resolve(new Error('Loading timed out'));
            };

        var body = document.getElementsByTagName('body')[0],
            elem = document.createElement('div');

        navigator.plugins.refresh(false); // refresh installed plugins

        // register load cb, inject <object>
        window[callback] = loadFn;
        body.appendChild(elem);
        elem.innerHTML =
            '<object width="1" height="1" id="'+id+'" type="'+mimetype+'">'+
            ' <param name="onload" value="'+callback+'" />'+
            '</object>';

        if (timeout) // register timeout cb
            timer = setTimeout(timeoutFn, timeout);
    }

    // Resolves the plugin loading process, either with an error
    // or a plugin object.
    function resolve(err, plugin) {

        if (!waiting) return;

        var callback = waiting.callback,
            errback = waiting.errback;

        if (timer) clearTimeout(timer);
        timer = waiting = null;

        if (err || !plugin || !plugin.version)
            if (errback)
                return errback(err);

        loaded = plugin;
        if (callback)
            callback(plugin);
    }

    // Returns true if plugin with a given mimetype is installed.
    function installed(mimetype) {
        var plugins = navigator.plugins,
            i, j;

        for (i = 0; i < plugins.length; i++)
            for (j = 0; j < plugins[i].length; j++)
                if (plugins[i][j].type === mimetype)
                    return true;

        return false;
    }

    // Promps a download dialog for the user.
    function install() {
        var body = document.getElementsByTagName('body')[0],
            elem = document.createElement('div');

        body.appendChild(elem);
        elem.innerHTML =
            '<div id="__trezor-install" style="'+
            '   width: 420px; height: 250px;'+
            '   position: absolute; top: 50%; right: 50%;'+
            '   margin: -125px -210px 0 0; padding: 10px 30px;'+
            '   box-shadow: 3px 3px 0 3px rgba(0, 0, 0, 0.2);'+
            '   background: #f6f6f6; color: #222;'+
            '   font-family: Helvetica, Arial, sans-serif; font-size: 16px;'+
            '   ">'+
            ' <h1 style="font-size: 42px; letter-spacing: -1px">Bitcoin Trezor Plugin</h1>'+
            ' <p style="margin-bottom: 40px; line-height: 1.5">Please install the Bitcoin Trezor Plugin to continue. Please install the Bitcoin Trezor Plugin to continue.</p>'+
            ' <a href="" id="__trezor-install-button" style="'+
            '   padding: 10px 20px; margin-right: 10px;'+
            '   text-decoration: none;'+
            '   background: #97bf0f; color: #fff;'+
            '   font-weight: bold;'+
            '   box-shadow: 2px 2px 0 1px rgba(0, 0, 0, 0.1)'+
            '   ">Download</a>'+
            ' <select id="__trezor-install-select" style="'+
            '   font-size: 16px;'+
            '   ">'+
            '  <option value="win"'+(sys==='win'?' selected':'')+'>for Windows</option>'+
            '  <option value="mac"'+(sys==='mac'?' selected':'')+'>for Mac OS X</option>'+
            '  <option value="deb"'+(sys==='deb'?' selected':'')+'>for Linux (deb)</option>'+
            '  <option value="rpm"'+(sys==='rpm'?' selected':'')+'>for Linux (rpm)</option>'+
            ' </select>'+
            '</div>';

        var button = document.getElementById('__trezor-install-button'),
            select = document.getElementById('__trezor-install-select');

        var assign_ = bind(select, 'change', assign),
            ground_ = bind(elem, 'click', ground),
            cancel_ = bind(document, 'click', cancel);

        var opts = ['win', 'mac', 'deb', 'rpm'],
            sys = system();

        if (sys) {
            select.selectedIndex = opts.indexOf(sys);
            assign();
        }

        function assign() {
            var opt = select.options[select.selectedIndex];
            button.href = opt.value;
        }

        function cancel() {
            body.removeChild(elem);
            cancel_();
            ground_();
            assign_();
        }

        function ground(ev) {
            ev.stopPropagation();
        }

        // Binds the event handler. Returns a thunk for unbinding.
        function bind(el, ev, fn) {
            if (el.addEventListener)
                el.addEventListener(ev, fn, false);
            else
                el.attachEvent('on' + ev, fn);

            return function () { unbind(el, ev, fn); };
        }

        // Unbinds the event handler.
        function unbind(el, ev, fn) {
            if (el.removeEventListener)
                el.removeEventListener(ev, fn, false);
            else
                el.detachEvent('on' + ev, fn);
        }
    }

    // Detects the OS.
    function system() {
        var ver = navigator.appVersion;

        if (ver.match(/Win/)) return 'win';
        if (ver.match(/Mac/)) return 'mac';
        if (ver.match(/Ubuntu|Debian/)) return 'deb';
        if (ver.match(/Fedora|RedHat|Suse/)) return 'rpm';
    }

    return {
        load: load,
        install: install,
        installed: installed
    };

}());

//
// Trezor API module
//
var TrezorApi = function() {

    var DEFAULT_URL = 'http://localhost:8000/signer/config_signed.bin';

    // Loads the plugin.
    // options = { timeout, configUrl }
    function load(callback, errback, options) {
        options = options || {};
        BrowserPlugin.load(function (plugin) {
            callback(new Trezor(plugin, options.configUrl));
        }, errback, options.timeout);
    }

    //
    // Trezor
    //
    var Trezor = function (plugin, url) {
        this._plugin = plugin;
        this._configure(url || _DEFAULT_URL);
    };

    // Downloads configuration from given url in blocking way and
    // configures the plugin.
    // Throws on error.
    Trezor.prototype._configure = function (url) {
        var req = new XMLHttpRequest(),
            time = new Date().getTime();

        req.open('get', url + '?' + time, false);
        req.send();

        if (req.status !== 200)
            throw Error('Failed to load configuration');

        this._plugin.configure(req.responseText);
    };

    // Returns the plugin version.
    Trezor.prototype.version = function () {
        return this._plugin.version;
    };

    // Returns the list of connected Trezor devices.
    Trezor.prototype.devices = function () {
        return this._plugin.devices;
    };

    // Opens a given device and returns a Session object.
    Trezor.prototype.open = function (device, on) {
        return new Session(device, on);
    };

    //
    // Trezor device session handle.
    //
    var Session = function (device, on) {
        this._device = device;
        this._on = on || {};
        this.open();
    };

    // Opens the session and acquires the HID device handle.
    Session.prototype.open = function () {
        this._device.open();
    };

    // Closes the session and the HID device.
    Session.prototype.close = function () {
        this._device.close();
    };

    Session.prototype.initialize = function (callback, errback) {
        this._call('Initialize', {}, function (t, m) {
            if (t === 'Failure') {
                errback(new Error(m.message));
                return;
            }
            if (t !== 'Features') {
                errback(new Error('Response of unexpected type'));
                return;
            }

            callback(m);
        });
    };

    Session.prototype.getEntropy = function (size, callback, errback) {
        this._call('GetEntropy', { size: size }, function (t, m) {
            if (t === 'Failure') {
                errback(new Error(m.message));
                return;
            }
            if (t !== 'Entropy') {
                errback(new Error('Response of unexpected type'));
                return;
            }

            callback(m.entropy);
        });
    };

    Session.prototype.getAddress = function (address_n, callback, errback) {
        this._call('GetAddress', { address_n: address_n }, function (t, m) {
            if (t === 'Failure') {
                errback(new Error(m.message));
                return;
            }
            if (t !== 'Address') {
                errback(new Error('Response of unexpected type'));
                return;
            }

            callback(m.address);
        });
    };

    Session.prototype.getMasterPublicKey = function (callback, errback) {
        this._call('GetMasterPublicKey', {}, function (t, m) {
            if (t === 'errback') {
                errback(new Error(m.message));
                return;
            }
            if (t !== 'MasterPublicKey') {
                errback(new Error('Response of unexpected type'));
                return;
            }

            callback(m.key);
        });
    };

    Session.prototype.signTx = function (inputs, outputs, callback, errback) {
        var self = this,
            signatures = [],
            serializedTx = '';

        this._call('SignTx', { inputs_count: inputs.length,
                               outputs_count: outputs.length }, process);

        function process (t, m) {

            if (t === 'Failure')
                return errback(new Error(m.message));

            if (t !== 'TxInputRequest')
                return errback(new Error('Response of unexpected type'));

            if (m.serialized_tx)
                serializedTx += m.serialized_tx;

            if (m.signature && m.signed_index >= 0)
                signatures[m.signed_index] = m.signature;

            if (m.request_index < 0)
                return callback(signatures, serializedTx);

            if (m.request_type == 'TXINPUT')
                self._call('TxInput', inputs[m.request_index], process);
            else
                self._call('TxOutput', outputs[m.request_index], process);
        }
    };

    Session.prototype._log = function () {
        if (!console || !console.log)
            return;
        [].unshift.call(arguments, '[trezor]');
        if (console.log.apply)
            console.log.apply(console, arguments);
        else
            console.log(arguments);
    };

    Session.prototype._call = function (type, msg, callback) {
        var self = this;

        self._log('Sending:', type, msg);

        self._device.call(type, msg, function (err, t, m) {
            if (err) {
                self._log('Received error:', err);
                if (self._on.error)
                    self._on.error(err);
                return;
            }

            self._log('Received:', t, m);

            if (t === 'ButtonRequest') {
                self._call('ButtonAck', {}, callback);
                return;
            }

            if (t === 'PinMatrixRequest') {
                if (self._on.pin)
                    self._on.pin(function (pin) {
                        if (pin)
                            self._call('PinMatrixAck', { pin: pin }, callback);
                        else
                            self._call('PinMatrixCancel', {}, callback);
                    });
                else {
                    self._log('PIN callback not configured, cancelling PIN request');
                    self._call('PinMatrixCancel', {}, callback);
                }
                return;
            }

            callback(t, m);
        });
    };

    return {
        load: load
    };
}();

//
// Hex codec
//
var Hex = (function () {

    // Encode binary string to hex string
    function encode(bin) {
        var i, chr, hex = '';

        for (i = 0; i < bin.length; i++) {
            chr = (bin.charCodeAt(i) & 0xFF).toString(16);
            hex += chr.length < 2 ? '0' + chr : chr;
        }

        return hex;
    }

    // Decode hex string to binary string
    function decode(hex) {
        var i, bytes = [];

        for (i = 0; i < hex.length - 1; i += 2)
            bytes.push(parseInt(hex.substr(i, 2), 16));

        return String.fromCharCode.apply(String, bytes);
    }

    return {
        encode: encode,
        decode: decode
    };

}());

return {
    hex: Hex,
    load: TrezorApi.load
};

}({}));
