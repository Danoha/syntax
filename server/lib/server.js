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
  
  var self = this;
  this.io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('disconnect', function() {
      console.log('user disconnected');
    });
    
    socket.on('chat message', function(msg) {
      console.log('message: ' + msg);
      
      self.io.emit('chat message', msg);
    });
  });
  
  
};

Server.prototype.listen = function(port) {
  console.log("listening on *:" + port);
  
  this.https.listen(port);
};


module.exports = Server;