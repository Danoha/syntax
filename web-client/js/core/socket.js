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

'use strict';

(function() {
  var ioServer = 'https://syntax-im.tk:2013';
  var clientLibrary = ioServer + '/socket.io/socket.io.js';

  define(['module'], function(module) {
    var _done = undefined;
    var done = function(err, io, url) {
      _done = arguments;
    };

    require([clientLibrary], function(io) {
      done(null, io(ioServer), clientLibrary);
    }, function() {
      done(new Error('Cannot continue without socket.io connection.'), null, clientLibrary);
    });

    return function(callback) {
      if(callback === undefined) {
        if(_done !== undefined)
          return _done[1];
        
        throw new Error('Invalid socket() call.');
      }
      
      if (_done === undefined) {
        var old = done;
        done = function() {
          old.apply(undefined, arguments);
          callback.apply(undefined, arguments);
        };
      } else
        callback.apply(undefined, _done);
    }
  });
})();
