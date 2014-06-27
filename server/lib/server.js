var SocketIO = require('socket.io');
var fs = require('fs');
var crypto = require('crypto');
var https = require('https');

//

var Server = function(credentials) {
  var opts = {
    key: fs.readFileSync(credentials.privateKey).toString(),
    cert: fs.readFileSync(credentials.certificate).toString(),
    secure: true
  };
  
  this.https = https.createServer(opts);
  this.io = SocketIO.listen(this.https);
};

Server.prototype.listen = function(port) {
  this.https.listen(port);
};


module.exports = Server;