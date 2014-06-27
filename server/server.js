
var config = require('./config.json');
var Server = require('./lib/server.js');

//

var server = new Server(config.credentials);
server.listen(config.port);