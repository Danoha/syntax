/* 
 * Copyright (C) 2014 Danoha
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

var dns = require('dns');
var os = require('os');

//

var Dns = function() {
  
};

Dns.prototype.getNetworkIPs = (function() {
  var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;
  var cached = null;

  return function() {
    if(cached !== null)
      return cached;
    
    cached = [];
    var ifaces = os.networkInterfaces();
    
    for(var k in ifaces) {
      for(var j in ifaces[k]) {
        if(ifaces[k][j].family !== 'IPv4')
          continue;
        
        var addr = ifaces[k][j].address;
        
        if (!ignoreRE.test(addr)) {
          cached.push(addr);
        }
      }
    }
    
    return cached;
  };
})();

Dns.prototype.getHostnames = (function() {
  var cached = null;
  
  return function(callback) {
    if(cached !== null) {
      callback(null, cached);
      return;
    }
    
    cached = [];
    var ips = this.getNetworkIPs();
    
    var done = 0;
    for(var k in ips) {
      var ip = ips[k];
      
      dns.reverse(ip, function(err, domains) {
        done++;
        
        if(!err)
          cached = cached.concat(domains);
        
        if(done === ips.length)
          callback(cached);
      });
    }
    
    if(ips.length === 0)
      callback(cached);
  };
})();

Dns.prototype.getHostname = function(callback) {
  var self = this;
  self.getHostnames(function(names) {
    if(names.length > 0)
      return callback(names[0]);
    
    var ips = self.getNetworkIPs();
    if(ips.length > 0)
      return callback(ips[0]);
    
    throw new Error('Could not determine hostname');
  });
};

module.exports = Dns;